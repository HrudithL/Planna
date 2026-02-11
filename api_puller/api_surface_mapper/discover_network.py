"""
Discover API endpoints via Playwright browser automation and HAR capture.
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Set
from urllib.parse import urlparse

from playwright.async_api import async_playwright

from .utils import logger, normalize_url


async def capture_network(
    start_url: str,
    har_path: str,
    allow_host: str,
    interactive: bool = True
) -> Set[str]:
    """
    Capture network traffic using Playwright.
    Returns a set of API URLs that match the allow_host.
    """
    captured_urls: Set[str] = set()
    allow_host_lower = allow_host.lower()
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=not interactive)
        
        # Create context with HAR recording
        context = await browser.new_context(
            record_har_path=har_path,
            record_har_mode="full"
        )
        
        # Register request handler to capture URLs
        def handle_request(request):
            url = request.url
            try:
                parsed = urlparse(url)
                if (parsed.netloc.lower() == allow_host_lower and
                    parsed.path.startswith("/api/")):
                    captured_urls.add(url)
                    logger.debug(f"Captured API request: {url}")
            except Exception as e:
                logger.debug(f"Failed to parse URL {url}: {e}")
        
        context.on("request", handle_request)
        
        page = await context.new_page()
        
        if interactive:
            # Interactive mode
            logger.info(f"Launching browser to {start_url}")
            logger.info("=" * 60)
            logger.info("INTERACTIVE MODE INSTRUCTIONS:")
            logger.info("1. The browser window will open shortly")
            logger.info("2. Log in if needed and reach an authenticated state")
            logger.info("3. Press ENTER in this terminal to start capturing")
            logger.info("4. Explore the UI (avoid destructive buttons!)")
            logger.info("5. Press ENTER again when done to save and exit")
            logger.info("=" * 60)
            
            await page.goto(start_url, wait_until="networkidle")
            
            # Wait for user to press Enter to start
            input("Press ENTER to start capturing network traffic...")
            logger.info("Capture started. Explore the UI, then press ENTER to stop.")
            
            # Wait for user to press Enter to stop
            input()
            logger.info("Capture stopped. Saving HAR file...")
        else:
            # Non-interactive mode - just navigate and wait
            logger.info(f"Navigating to {start_url} in headless mode")
            await page.goto(start_url, wait_until="networkidle")
            await asyncio.sleep(2)  # Give time for any delayed requests
        
        # Close context to finalize HAR
        await context.close()
        await browser.close()
    
    logger.info(f"Captured {len(captured_urls)} API URLs")
    return captured_urls


def parse_har_for_urls(har_path: str, allow_host: str) -> Set[str]:
    """
    Parse a HAR file and extract API URLs matching the allowed host.
    """
    urls = set()
    allow_host_lower = allow_host.lower()
    
    try:
        with open(har_path, "r", encoding="utf-8") as f:
            har_data = json.load(f)
        
        entries = har_data.get("log", {}).get("entries", [])
        for entry in entries:
            request = entry.get("request", {})
            url = request.get("url", "")
            
            try:
                parsed = urlparse(url)
                if (parsed.netloc.lower() == allow_host_lower and
                    parsed.path.startswith("/api/")):
                    urls.add(url)
            except Exception:
                pass
        
        logger.info(f"Extracted {len(urls)} API URLs from HAR file")
    except Exception as e:
        logger.error(f"Failed to parse HAR file: {e}")
    
    return urls


def main():
    parser = argparse.ArgumentParser(
        description="Discover API endpoints via browser network capture"
    )
    parser.add_argument(
        "--url",
        required=True,
        help="Start URL to navigate to"
    )
    parser.add_argument(
        "--out",
        default="network.har",
        help="Output HAR file path (default: network.har)"
    )
    parser.add_argument(
        "--allow-host",
        default="app.schoolinks.com",
        help="Allowed host for API requests (default: app.schoolinks.com)"
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        default=True,
        help="Launch browser in interactive mode (default: True)"
    )
    parser.add_argument(
        "--no-interactive",
        dest="interactive",
        action="store_false",
        help="Run in headless non-interactive mode"
    )
    
    args = parser.parse_args()
    
    # Run capture
    captured_urls = asyncio.run(
        capture_network(
            start_url=args.url,
            har_path=args.out,
            allow_host=args.allow_host,
            interactive=args.interactive
        )
    )
    
    # Also parse HAR to get any missed URLs
    har_urls = parse_har_for_urls(args.out, args.allow_host)
    all_urls = captured_urls | har_urls
    
    # Normalize and deduplicate
    normalized_urls = sorted(set(normalize_url(url) for url in all_urls))
    
    # Write outputs
    output_dir = Path(args.out).parent
    
    # network_urls.txt - full URLs
    urls_file = output_dir / "network_urls.txt"
    with open(urls_file, "w", encoding="utf-8") as f:
        for url in normalized_urls:
            f.write(url + "\n")
    logger.info(f"Wrote {len(normalized_urls)} URLs to {urls_file}")
    
    # network_paths.txt - normalized endpoint forms
    from .utils import keyed_endpoint, format_endpoint_key
    
    endpoint_keys = set()
    for url in normalized_urls:
        path, query_keys = keyed_endpoint(url)
        endpoint_keys.add(format_endpoint_key(path, query_keys))
    
    paths_file = output_dir / "network_paths.txt"
    with open(paths_file, "w", encoding="utf-8") as f:
        for endpoint in sorted(endpoint_keys):
            f.write(endpoint + "\n")
    logger.info(f"Wrote {len(endpoint_keys)} unique endpoints to {paths_file}")
    
    logger.info("Network discovery complete!")


if __name__ == "__main__":
    main()

