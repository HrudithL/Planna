"""
Shared utilities for URL normalization, HTTP client, rate limiting, and NDJSON handling.
"""
import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse

import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


# --- URL Normalization ---

def normalize_url(url: str) -> str:
    """
    Normalize a URL to a canonical form:
    - Lowercase scheme and host
    - Remove fragment
    - Keep path
    - Sort query parameters
    """
    parsed = urlparse(url)
    # Sort query parameters
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    sorted_query = "&".join(
        f"{k}={v[0]}" for k, v in sorted(query_params.items())
    )
    
    normalized = urlunparse((
        parsed.scheme.lower(),
        parsed.netloc.lower(),
        parsed.path,
        parsed.params,
        sorted_query,
        ""  # Remove fragment
    ))
    return normalized


def keyed_endpoint(url: str) -> Tuple[str, Tuple[str, ...]]:
    """
    Extract (path, sorted_query_keys) tuple for deduplication.
    """
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    query_keys = tuple(sorted(query_params.keys()))
    return (parsed.path, query_keys)


def format_endpoint_key(path: str, query_keys: Tuple[str, ...]) -> str:
    """
    Format an endpoint key as path?key1,key2,key3
    """
    if query_keys:
        return f"{path}?{','.join(query_keys)}"
    return path


# --- Endpoint Deduplication ---

class EndpointSet:
    """
    Manages a set of unique endpoints keyed by (path, query_keys).
    Stores a representative full URL for each unique endpoint.
    """
    def __init__(self):
        self._endpoints: Dict[Tuple[str, Tuple[str, ...]], str] = {}
    
    def add(self, url: str) -> bool:
        """
        Add a URL to the set. Returns True if it was new, False if duplicate.
        """
        key = keyed_endpoint(url)
        if key not in self._endpoints:
            self._endpoints[key] = normalize_url(url)
            return True
        return False
    
    def __contains__(self, url: str) -> bool:
        key = keyed_endpoint(url)
        return key in self._endpoints
    
    def __len__(self) -> int:
        return len(self._endpoints)
    
    def items(self):
        """Iterate over (key, url) pairs."""
        return self._endpoints.items()
    
    def keys(self):
        """Iterate over endpoint keys."""
        return self._endpoints.keys()
    
    def get_url(self, key: Tuple[str, Tuple[str, ...]]) -> Optional[str]:
        """Get the representative URL for a key."""
        return self._endpoints.get(key)


# --- HTTP Client and Retry Logic ---

class HTTPClient:
    """
    Async HTTP client with rate limiting, retries, and safety checks.
    """
    def __init__(
        self,
        allow_host: str,
        rate_limit_ms: int = 150,
        max_concurrency: int = 6,
        timeout: float = 30.0
    ):
        self.allow_host = allow_host.lower()
        self.rate_limit_ms = rate_limit_ms
        self.timeout = timeout
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=max_concurrency)
        )
        self.last_request_time = 0
        self.consecutive_auth_failures = 0
        self.auth_failure_threshold = 10
    
    async def _rate_limit(self):
        """Apply rate limiting delay."""
        now = time.time()
        elapsed = (now - self.last_request_time) * 1000  # to ms
        if elapsed < self.rate_limit_ms:
            await asyncio.sleep((self.rate_limit_ms - elapsed) / 1000)
        self.last_request_time = time.time()
    
    def _check_host(self, url: str) -> bool:
        """Check if URL host matches allowed host."""
        parsed = urlparse(url)
        return parsed.netloc.lower() == self.allow_host
    
    async def get(
        self,
        url: str,
        max_retries: int = 4
    ) -> httpx.Response:
        """
        Perform GET request with retries and rate limiting.
        Raises httpx.HTTPStatusError for non-retryable errors.
        """
        if not self._check_host(url):
            raise ValueError(f"Host not allowed: {url}")
        
        async with self.semaphore:
            await self._rate_limit()
            
            for attempt in range(max_retries):
                try:
                    response = await self.client.get(url)
                    
                    # Track auth failures
                    if response.status_code in (401, 403):
                        self.consecutive_auth_failures += 1
                        if self.consecutive_auth_failures >= self.auth_failure_threshold:
                            logger.error(
                                f"Consistent auth failures detected "
                                f"({self.consecutive_auth_failures} consecutive 401/403). "
                                f"Stopping crawl."
                            )
                            raise AuthBlockedException("Too many auth failures")
                    else:
                        self.consecutive_auth_failures = 0
                    
                    # Retry on 429 or 5xx
                    if response.status_code == 429 or response.status_code >= 500:
                        if attempt < max_retries - 1:
                            backoff = 0.5 * (2 ** attempt)  # 0.5, 1, 2, 4 seconds
                            logger.warning(
                                f"Status {response.status_code} for {url}, "
                                f"retrying in {backoff}s (attempt {attempt + 1}/{max_retries})"
                            )
                            await asyncio.sleep(backoff)
                            continue
                    
                    return response
                    
                except (httpx.TimeoutException, httpx.NetworkError) as e:
                    if attempt < max_retries - 1:
                        backoff = 0.5 * (2 ** attempt)
                        logger.warning(
                            f"Network error for {url}: {e}, "
                            f"retrying in {backoff}s (attempt {attempt + 1}/{max_retries})"
                        )
                        await asyncio.sleep(backoff)
                        continue
                    raise
            
            # Final attempt failed
            return response
    
    async def get_json(self, url: str) -> Tuple[httpx.Response, Optional[Any]]:
        """
        GET request and parse JSON. Returns (response, json_data).
        If JSON parsing fails, json_data is None.
        """
        response = await self.get(url)
        try:
            json_data = response.json()
            return response, json_data
        except Exception as e:
            logger.debug(f"Failed to parse JSON from {url}: {e}")
            return response, None
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


class AuthBlockedException(Exception):
    """Raised when too many auth failures are detected."""
    pass


# --- NDJSON Utilities ---

def write_ndjson(path: str, items: List[Dict[str, Any]]):
    """
    Write a list of dictionaries as NDJSON (newline-delimited JSON).
    """
    with open(path, "w", encoding="utf-8") as f:
        for item in items:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")


def append_ndjson(path: str, item: Dict[str, Any]):
    """
    Append a single dictionary to an NDJSON file.
    """
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")


def read_ndjson(path: str) -> List[Dict[str, Any]]:
    """
    Read an NDJSON file into a list of dictionaries.
    """
    items = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                items.append(json.loads(line))
    return items


# --- JSON Traversal for Link Extraction ---

UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE
)


def extract_urls_from_json(data: Any, allow_host: str) -> Set[str]:
    """
    Recursively traverse JSON data and extract API URLs matching the allowed host.
    """
    urls = set()
    allow_host_lower = allow_host.lower()
    
    def traverse(obj):
        if isinstance(obj, dict):
            for value in obj.values():
                traverse(value)
        elif isinstance(obj, list):
            for item in obj:
                traverse(item)
        elif isinstance(obj, str):
            # Check if it looks like a URL
            if obj.startswith("http://") or obj.startswith("https://"):
                try:
                    parsed = urlparse(obj)
                    if (parsed.netloc.lower() == allow_host_lower and
                        parsed.path.startswith("/api/")):
                        urls.add(obj)
                except Exception:
                    pass
    
    traverse(data)
    return urls


def extract_uuid_fields(item: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract fields that look like UUIDs from a dictionary.
    Returns {field_name: uuid_value}.
    """
    uuids = {}
    for key, value in item.items():
        if isinstance(value, str) and UUID_REGEX.match(value):
            uuids[key] = value
    return uuids


def synthesize_detail_url(list_path: str, uuid_value: str, origin: str) -> Optional[str]:
    """
    Synthesize a detail URL from a list endpoint path and UUID.
    Example: /api/v2/courses/ + uuid -> /api/v2/courses/{uuid}/
    """
    # Ensure path ends with /
    if not list_path.endswith("/"):
        list_path += "/"
    
    detail_path = f"{list_path}{uuid_value}/"
    return urljoin(origin, detail_path)

