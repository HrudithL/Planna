"""
Discover API endpoints by parsing JavaScript bundles.
"""
import argparse
import asyncio
import re
from typing import Set
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .utils import HTTPClient, logger


API_PATH_REGEX = re.compile(
    r'["\'](/api/(?:v[0-9]+/)?[A-Za-z0-9_./-]*)["\']',
    re.IGNORECASE
)


async def discover_js_endpoints(
    origin: str,
    allow_host: str,
    max_bundles: int = 50
) -> Set[str]:
    """
    Discover API endpoints by downloading and parsing JS bundles.
    Returns a set of fully qualified API URLs.
    """
    client = HTTPClient(allow_host=allow_host, rate_limit_ms=100, max_concurrency=3)
    endpoints = set()
    
    try:
        # Fetch the origin page
        logger.info(f"Fetching HTML from {origin}")
        response = await client.get(origin)
        
        if response.status_code != 200:
            logger.error(f"Failed to fetch {origin}: status {response.status_code}")
            return endpoints
        
        html = response.text
        soup = BeautifulSoup(html, "html.parser")
        
        # Extract script URLs
        script_tags = soup.find_all("script", src=True)
        script_urls = []
        
        for tag in script_tags[:max_bundles]:
            src = tag.get("src")
            if src:
                # Resolve relative URLs
                full_url = urljoin(origin, src)
                script_urls.append(full_url)
        
        logger.info(f"Found {len(script_urls)} script tags (processing up to {max_bundles})")
        
        # Download and parse each bundle
        for i, script_url in enumerate(script_urls[:max_bundles], 1):
            try:
                logger.info(f"[{i}/{len(script_urls[:max_bundles])}] Downloading {script_url}")
                
                # Check if it's on the same host or a CDN
                parsed_script = urlparse(script_url)
                if parsed_script.netloc.lower() != allow_host.lower():
                    # It's a CDN or external script, use a separate client
                    # For simplicity, we'll allow this specific request
                    import httpx
                    async with httpx.AsyncClient(timeout=30.0) as external_client:
                        script_response = await external_client.get(script_url)
                else:
                    script_response = await client.get(script_url)
                
                if script_response.status_code != 200:
                    logger.warning(
                        f"Failed to download {script_url}: "
                        f"status {script_response.status_code}"
                    )
                    continue
                
                # Check content type
                content_type = script_response.headers.get("content-type", "")
                if "javascript" not in content_type and "text/plain" not in content_type:
                    logger.warning(
                        f"Skipping {script_url}: unexpected content-type {content_type}"
                    )
                    continue
                
                # Extract API paths from the JS content
                js_content = script_response.text
                matches = API_PATH_REGEX.findall(js_content)
                
                for path in matches:
                    # Clean up the path
                    path = path.strip()
                    if not path.startswith("/api/"):
                        continue
                    
                    # Remove trailing artifacts like quotes
                    path = path.rstrip('"\' ')
                    
                    # Build full URL
                    full_url = urljoin(origin, path)
                    endpoints.add(full_url)
                
                if matches:
                    logger.info(f"  Found {len(matches)} API path references")
            
            except Exception as e:
                logger.warning(f"Error processing {script_url}: {e}")
                continue
        
        logger.info(f"Discovered {len(endpoints)} unique API endpoints from JS bundles")
    
    finally:
        await client.close()
    
    return endpoints


def main():
    parser = argparse.ArgumentParser(
        description="Discover API endpoints by parsing JavaScript bundles"
    )
    parser.add_argument(
        "--origin",
        required=True,
        help=(
            "Origin URL / start page "
            "(e.g., https://app.schoolinks.com/course-catalog/katy-isd/course-offerings)"
        )
    )
    parser.add_argument(
        "--out",
        default="js_endpoints.txt",
        help="Output file path (default: js_endpoints.txt)"
    )
    parser.add_argument(
        "--allow-host",
        default="app.schoolinks.com",
        help="Allowed host for API requests (default: app.schoolinks.com)"
    )
    parser.add_argument(
        "--max-bundles",
        type=int,
        default=50,
        help="Maximum number of JS bundles to download (default: 50)"
    )
    
    args = parser.parse_args()
    
    # Discover endpoints
    endpoints = asyncio.run(
        discover_js_endpoints(
            origin=args.origin,
            allow_host=args.allow_host,
            max_bundles=args.max_bundles
        )
    )
    
    # Write to output file
    sorted_endpoints = sorted(endpoints)
    with open(args.out, "w", encoding="utf-8") as f:
        for endpoint in sorted_endpoints:
            f.write(endpoint + "\n")
    
    logger.info(f"Wrote {len(sorted_endpoints)} endpoints to {args.out}")
    logger.info("JS discovery complete!")


if __name__ == "__main__":
    main()

