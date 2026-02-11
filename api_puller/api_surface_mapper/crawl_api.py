"""
Endpoint classification, pagination draining, and data dumping.
"""
import asyncio
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse

from tqdm import tqdm

from .utils import (
    AuthBlockedException,
    HTTPClient,
    append_ndjson,
    extract_urls_from_json,
    extract_uuid_fields,
    format_endpoint_key,
    keyed_endpoint,
    logger,
    normalize_url,
    synthesize_detail_url,
)


# --- Endpoint Classification ---

async def classify_endpoint(
    url: str,
    client: HTTPClient
) -> Dict[str, Any]:
    """
    Classify an endpoint by making a single GET request and analyzing the response.
    Returns a classification dict with type, keys, status, etc.
    """
    classification = {
        "url": url,
        "classification": "unknown",
        "status": None,
        "sample_keys": [],
        "error": None
    }
    
    try:
        response, json_data = await client.get_json(url)
        classification["status"] = response.status_code
        
        if response.status_code >= 400:
            classification["classification"] = "error"
            classification["error"] = f"HTTP {response.status_code}"
            return classification
        
        if json_data is None:
            # Non-JSON response
            classification["classification"] = "non_json"
            classification["content_type"] = response.headers.get("content-type", "")
            return classification
        
        # Analyze JSON structure
        if isinstance(json_data, dict):
            keys = list(json_data.keys())
            classification["sample_keys"] = keys
            
            # Check for DRF pagination pattern
            if "results" in keys and "next" in keys:
                classification["classification"] = "paginated_drf"
            else:
                classification["classification"] = "json_object"
        
        elif isinstance(json_data, list):
            classification["classification"] = "json_array"
            if json_data:
                # Sample the first element
                first_item = json_data[0]
                if isinstance(first_item, dict):
                    classification["sample_keys"] = list(first_item.keys())
        
        else:
            classification["classification"] = "json_primitive"
    
    except AuthBlockedException:
        classification["classification"] = "auth_blocked"
        classification["error"] = "Authentication required"
        raise  # Re-raise to stop crawling
    
    except Exception as e:
        classification["classification"] = "error"
        classification["error"] = str(e)
        logger.debug(f"Error classifying {url}: {e}")
    
    return classification


async def classify_endpoints(
    urls: List[str],
    client: HTTPClient,
    show_progress: bool = True
) -> Dict[Tuple[str, Tuple[str, ...]], Dict[str, Any]]:
    """
    Classify a list of endpoint URLs.
    Returns a dict mapping endpoint key -> classification.
    """
    classifications = {}
    
    # Deduplicate by endpoint key
    url_by_key = {}
    for url in urls:
        key = keyed_endpoint(url)
        if key not in url_by_key:
            url_by_key[key] = url
    
    logger.info(f"Classifying {len(url_by_key)} unique endpoints...")
    
    tasks = []
    for key, url in url_by_key.items():
        tasks.append((key, classify_endpoint(url, client)))
    
    # Run classifications with progress bar
    if show_progress:
        pbar = tqdm(total=len(tasks), desc="Classifying", unit="endpoint")
    
    try:
        for key, task in tasks:
            classification = await task
            classifications[key] = classification
            if show_progress:
                pbar.update(1)
    finally:
        if show_progress:
            pbar.close()
    
    return classifications


# --- Pagination & Crawling ---

class APICrawler:
    """
    Crawls API endpoints, drains pagination, and expands links/details.
    """
    def __init__(
        self,
        client: HTTPClient,
        output_dir: Path,
        max_urls: int = 20000,
        origin: str = "https://app.schoolinks.com"
    ):
        self.client = client
        self.output_dir = output_dir
        self.max_urls = max_urls
        self.origin = origin
        
        # Output files
        self.responses_file = output_dir / "responses.ndjson"
        self.items_file = output_dir / "items.ndjson"
        self.errors_file = output_dir / "errors.ndjson"
        
        # Ensure output directory exists
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize output files (truncate if exist)
        for f in [self.responses_file, self.items_file, self.errors_file]:
            f.write_text("", encoding="utf-8")
        
        # State tracking
        self.seen_urls: Set[str] = set()
        self.url_queue: List[str] = []
        self.stats = defaultdict(int)
        self.endpoint_stats = defaultdict(lambda: defaultdict(int))
    
    def enqueue_url(self, url: str):
        """Add a URL to the queue if not seen and under limit."""
        normalized = normalize_url(url)
        if normalized not in self.seen_urls and len(self.seen_urls) < self.max_urls:
            self.seen_urls.add(normalized)
            self.url_queue.append(normalized)
            return True
        return False
    
    def _update_page_url_for_pagination(self, url: str, page: int = 1, page_size: int = 100) -> str:
        """
        Update URL query parameters to set page and page_size for pagination start.
        """
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query, keep_blank_values=True)
        
        # Set page and page_size
        query_params["page"] = [str(page)]
        
        # Check existing page_size
        existing_page_size = query_params.get("page_size", ["0"])
        try:
            existing_size = int(existing_page_size[0])
            if existing_size > page_size:
                page_size = existing_size
        except (ValueError, IndexError):
            pass
        
        query_params["page_size"] = [str(page_size)]
        
        # Rebuild query string
        new_query = "&".join(f"{k}={v[0]}" for k, v in sorted(query_params.items()))
        
        new_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            ""
        ))
        return new_url
    
    async def crawl_paginated_endpoint(
        self,
        seed_url: str,
        endpoint_key: Tuple[str, Tuple[str, ...]],
        pbar: Optional[tqdm] = None
    ):
        """
        Crawl a paginated DRF endpoint, following 'next' links until exhausted.
        """
        endpoint_key_str = format_endpoint_key(*endpoint_key)
        
        # Prepare seed URL with pagination params
        path, query_keys = endpoint_key
        if "page" in query_keys or "page_size" in query_keys:
            current_url = self._update_page_url_for_pagination(seed_url, page=1, page_size=100)
        else:
            current_url = seed_url
        
        page_num = 0
        
        while current_url and len(self.seen_urls) < self.max_urls:
            try:
                response, json_data = await self.client.get_json(current_url)
                self.stats["total_requests"] += 1
                self.endpoint_stats[endpoint_key_str]["requests"] += 1
                
                if response.status_code >= 400:
                    # Error response
                    append_ndjson(self.errors_file, {
                        "url": current_url,
                        "endpoint_key": endpoint_key_str,
                        "status": response.status_code,
                        "error_type": "http_error"
                    })
                    self.stats["total_errors"] += 1
                    break
                
                # Write response
                append_ndjson(self.responses_file, {
                    "endpoint_key": endpoint_key_str,
                    "url": current_url,
                    "kind": "list_page",
                    "page": page_num,
                    "status": response.status_code,
                    "body": json_data
                })
                
                if json_data and isinstance(json_data, dict):
                    results = json_data.get("results", [])
                    
                    # Write items
                    for item in results:
                        append_ndjson(self.items_file, {
                            "source_endpoint": endpoint_key_str,
                            "source_page_url": current_url,
                            "item": item
                        })
                        self.stats["total_items"] += 1
                        self.endpoint_stats[endpoint_key_str]["items"] += 1
                        
                        # Expand detail URLs from item
                        await self._expand_from_item(item, path)
                    
                    # Extract and enqueue linked URLs
                    linked_urls = extract_urls_from_json(json_data, self.client.allow_host)
                    for linked_url in linked_urls:
                        self.enqueue_url(linked_url)
                    
                    # Follow next link
                    next_url = json_data.get("next")
                    if next_url:
                        current_url = next_url
                        page_num += 1
                        if pbar:
                            pbar.set_postfix({"endpoint": endpoint_key_str[:40], "page": page_num})
                    else:
                        # No more pages
                        break
                else:
                    # Unexpected format
                    break
            
            except AuthBlockedException:
                logger.error(f"Auth blocked while crawling {endpoint_key_str}")
                raise
            
            except Exception as e:
                append_ndjson(self.errors_file, {
                    "url": current_url,
                    "endpoint_key": endpoint_key_str,
                    "error_type": "exception",
                    "error": str(e)
                })
                self.stats["total_errors"] += 1
                logger.debug(f"Error crawling {current_url}: {e}")
                break
    
    async def crawl_single_endpoint(
        self,
        url: str,
        endpoint_key: Tuple[str, Tuple[str, ...]],
        classification: str
    ):
        """
        Crawl a non-paginated endpoint (json_object or json_array).
        """
        endpoint_key_str = format_endpoint_key(*endpoint_key)
        
        try:
            response, json_data = await self.client.get_json(url)
            self.stats["total_requests"] += 1
            self.endpoint_stats[endpoint_key_str]["requests"] += 1
            
            if response.status_code >= 400:
                append_ndjson(self.errors_file, {
                    "url": url,
                    "endpoint_key": endpoint_key_str,
                    "status": response.status_code,
                    "error_type": "http_error"
                })
                self.stats["total_errors"] += 1
                return
            
            # Write response
            append_ndjson(self.responses_file, {
                "endpoint_key": endpoint_key_str,
                "url": url,
                "kind": classification,
                "status": response.status_code,
                "body": json_data
            })
            
            # Handle json_array - extract items
            if classification == "json_array" and isinstance(json_data, list):
                for item in json_data:
                    append_ndjson(self.items_file, {
                        "source_endpoint": endpoint_key_str,
                        "source_url": url,
                        "item": item
                    })
                    self.stats["total_items"] += 1
                    self.endpoint_stats[endpoint_key_str]["items"] += 1
            
            # Extract and enqueue linked URLs
            if json_data:
                linked_urls = extract_urls_from_json(json_data, self.client.allow_host)
                for linked_url in linked_urls:
                    self.enqueue_url(linked_url)
        
        except AuthBlockedException:
            logger.error(f"Auth blocked while crawling {endpoint_key_str}")
            raise
        
        except Exception as e:
            append_ndjson(self.errors_file, {
                "url": url,
                "endpoint_key": endpoint_key_str,
                "error_type": "exception",
                "error": str(e)
            })
            self.stats["total_errors"] += 1
            logger.debug(f"Error crawling {url}: {e}")
    
    async def _expand_from_item(self, item: Dict[str, Any], list_path: str):
        """
        Expand detail URLs from an item (UUID fields and 'url' field).
        """
        if not isinstance(item, dict):
            return
        
        # Check for 'url' field pointing to an API URL
        if "url" in item and isinstance(item["url"], str):
            url_value = item["url"]
            if url_value.startswith("http"):
                try:
                    parsed = urlparse(url_value)
                    if (parsed.netloc.lower() == self.client.allow_host and
                        parsed.path.startswith("/api/")):
                        self.enqueue_url(url_value)
                except Exception:
                    pass
        
        # Extract UUID fields and synthesize detail URLs
        uuid_fields = extract_uuid_fields(item)
        for field_name, uuid_value in uuid_fields.items():
            detail_url = synthesize_detail_url(list_path, uuid_value, self.origin)
            if detail_url:
                self.enqueue_url(detail_url)
    
    async def crawl_all(
        self,
        classifications: Dict[Tuple[str, Tuple[str, ...]], Dict[str, Any]],
        show_progress: bool = True
    ):
        """
        Crawl all classified endpoints, following pagination and expanding links.
        """
        # Seed the queue with classified endpoints
        for key, classification in classifications.items():
            if classification["classification"] in ("paginated_drf", "json_object", "json_array"):
                self.enqueue_url(classification["url"])
        
        logger.info(f"Starting crawl with {len(self.url_queue)} seed URLs")
        
        if show_progress:
            pbar = tqdm(desc="Crawling", unit="url")
        else:
            pbar = None
        
        try:
            processed = 0
            while self.url_queue and processed < self.max_urls:
                url = self.url_queue.pop(0)
                processed += 1
                
                # Determine endpoint classification
                key = keyed_endpoint(url)
                classification_info = classifications.get(key)
                
                if classification_info:
                    classification = classification_info["classification"]
                else:
                    # Unknown endpoint - classify on the fly
                    classification_info = await classify_endpoint(url, self.client)
                    classification = classification_info["classification"]
                    classifications[key] = classification_info
                
                # Crawl based on classification
                if classification == "paginated_drf":
                    # Use the full classified URL (including host & query) as the seed
                    seed_url = classification_info["url"]
                    await self.crawl_paginated_endpoint(seed_url, key, pbar)
                elif classification in ("json_object", "json_array"):
                    await self.crawl_single_endpoint(url, key, classification)
                
                if pbar is not None:
                    pbar.update(1)
                    pbar.set_postfix({
                        "queue": len(self.url_queue),
                        "items": self.stats["total_items"],
                        "errors": self.stats["total_errors"]
                    })
        
        except AuthBlockedException:
            logger.error("Crawl stopped due to authentication failures")
            self.stats["auth_blocked"] = True
        
        finally:
            if pbar is not None:
                pbar.close()
        
        logger.info(f"Crawl complete: {self.stats['total_requests']} requests, "
                   f"{self.stats['total_items']} items, {self.stats['total_errors']} errors")
    
    def write_stats(self, stats_file: Path):
        """Write crawl statistics to JSON file."""
        stats_data = {
            "total_endpoints": len(self.endpoint_stats),
            "total_requests": self.stats["total_requests"],
            "total_items": self.stats["total_items"],
            "total_errors": self.stats["total_errors"],
            "auth_blocked": self.stats.get("auth_blocked", False),
            "endpoint_stats": dict(self.endpoint_stats)
        }
        
        with open(stats_file, "w", encoding="utf-8") as f:
            json.dump(stats_data, f, indent=2)
        
        logger.info(f"Wrote statistics to {stats_file}")

