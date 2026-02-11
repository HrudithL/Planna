"""
Main orchestration: merge discoveries, classify endpoints, and crawl API.
"""
import argparse
import asyncio
import json
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from .crawl_api import APICrawler, classify_endpoints
from .utils import (
    EndpointSet,
    HTTPClient,
    format_endpoint_key,
    logger,
    normalize_url,
)


def load_har_urls(har_path: str, allow_host: str) -> List[str]:
    """
    Load API URLs from a HAR file.
    """
    urls = []
    allow_host_lower = allow_host.lower()
    
    try:
        with open(har_path, "r", encoding="utf-8") as f:
            har_data = json.load(f)
        
        entries = har_data.get("log", {}).get("entries", [])
        for entry in entries:
            request = entry.get("request", {})
            url = request.get("url", "")
            
            from urllib.parse import urlparse
            try:
                parsed = urlparse(url)
                if (parsed.netloc.lower() == allow_host_lower and
                    parsed.path.startswith("/api/")):
                    urls.append(url)
            except Exception:
                pass
        
        logger.info(f"Loaded {len(urls)} API URLs from HAR file")
    except FileNotFoundError:
        logger.warning(f"HAR file not found: {har_path}")
    except Exception as e:
        logger.error(f"Failed to load HAR file: {e}")
    
    return urls


def load_url_list(file_path: str) -> List[str]:
    """
    Load URLs from a text file (one per line).
    """
    urls = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    urls.append(line)
        logger.info(f"Loaded {len(urls)} URLs from {file_path}")
    except FileNotFoundError:
        logger.warning(f"File not found: {file_path}")
    except Exception as e:
        logger.error(f"Failed to load {file_path}: {e}")
    
    return urls


def merge_and_deduplicate(url_sources: List[List[str]]) -> EndpointSet:
    """
    Merge multiple lists of URLs and deduplicate by endpoint key.
    """
    endpoint_set = EndpointSet()
    
    for url_list in url_sources:
        for url in url_list:
            try:
                normalized = normalize_url(url)
                endpoint_set.add(normalized)
            except Exception as e:
                logger.debug(f"Failed to normalize URL {url}: {e}")
    
    logger.info(f"Merged to {len(endpoint_set)} unique endpoints")
    return endpoint_set


async def run_mapper(
    har_path: Optional[str],
    js_path: Optional[str],
    output_dir: Path,
    allow_host: str,
    origin: str,
    dry_run: bool,
    max_urls: int,
    rate_limit_ms: int,
    max_concurrency: int
):
    """
    Main mapper logic: load, merge, classify, and crawl.
    """
    # Load URLs from various sources
    url_sources = []
    
    if har_path:
        har_urls = load_har_urls(har_path, allow_host)
        url_sources.append(har_urls)
    
    if js_path:
        js_urls = load_url_list(js_path)
        url_sources.append(js_urls)
    
    # Also try to load network_urls.txt if it exists
    network_urls_path = Path(har_path).parent / "network_urls.txt" if har_path else None
    if network_urls_path and network_urls_path.exists():
        network_urls = load_url_list(str(network_urls_path))
        url_sources.append(network_urls)
    
    if not url_sources:
        logger.error("No URL sources provided. Use --har and/or --js options.")
        return
    
    # Merge and deduplicate
    endpoint_set = merge_and_deduplicate(url_sources)
    
    if len(endpoint_set) == 0:
        logger.error("No endpoints discovered. Exiting.")
        return
    
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Write discovered endpoints
    discovered_file = output_dir / "endpoints.discovered.txt"
    with open(discovered_file, "w", encoding="utf-8") as f:
        for key in sorted(endpoint_set.keys()):
            endpoint_str = format_endpoint_key(*key)
            f.write(endpoint_str + "\n")
    logger.info(f"Wrote {len(endpoint_set)} discovered endpoints to {discovered_file}")
    
    # Create HTTP client
    client = HTTPClient(
        allow_host=allow_host,
        rate_limit_ms=rate_limit_ms,
        max_concurrency=max_concurrency
    )
    
    try:
        # Get list of URLs to classify
        urls_to_classify = [endpoint_set.get_url(key) for key in endpoint_set.keys()]
        
        # Classify endpoints
        classifications = await classify_endpoints(urls_to_classify, client)
        
        # Write classifications
        classified_file = output_dir / "endpoints.classified.json"
        classified_data = {}
        for key, classification in classifications.items():
            key_str = format_endpoint_key(*key)
            classified_data[key_str] = classification
        
        with open(classified_file, "w", encoding="utf-8") as f:
            json.dump(classified_data, f, indent=2)
        logger.info(f"Wrote classifications to {classified_file}")
        
        # Summary of classifications
        classification_counts = {}
        for classification in classifications.values():
            cls = classification["classification"]
            classification_counts[cls] = classification_counts.get(cls, 0) + 1
        
        logger.info("Classification summary:")
        for cls, count in sorted(classification_counts.items()):
            logger.info(f"  {cls}: {count}")
        
        if dry_run:
            logger.info("Dry run mode: stopping before full crawl")
            # Write minimal stats
            stats_file = output_dir / "stats.json"
            stats_data = {
                "total_endpoints": len(endpoint_set),
                "classified_counts": classification_counts,
                "dry_run": True
            }
            with open(stats_file, "w", encoding="utf-8") as f:
                json.dump(stats_data, f, indent=2)
            logger.info(f"Wrote stats to {stats_file}")
        else:
            # Full crawl
            logger.info("Starting full crawl...")
            crawler = APICrawler(
                client=client,
                output_dir=output_dir,
                max_urls=max_urls,
                origin=origin
            )
            
            await crawler.crawl_all(classifications)
            
            # Write final stats
            stats_file = output_dir / "stats.json"
            crawler.write_stats(stats_file)
            
            # Add classification counts to stats
            with open(stats_file, "r", encoding="utf-8") as f:
                stats_data = json.load(f)
            stats_data["classified_counts"] = classification_counts
            stats_data["total_discovered_endpoints"] = len(endpoint_set)
            with open(stats_file, "w", encoding="utf-8") as f:
                json.dump(stats_data, f, indent=2)
    
    finally:
        await client.close()


def main():
    parser = argparse.ArgumentParser(
        description="API Surface Mapper - Discover, classify, and crawl API endpoints"
    )
    parser.add_argument(
        "--har",
        help="Path to HAR file from network capture"
    )
    parser.add_argument(
        "--js",
        help="Path to JS endpoints file"
    )
    parser.add_argument(
        "--out",
        default="dump",
        help="Output directory (default: dump)"
    )
    parser.add_argument(
        "--allow-host",
        default="app.schoolinks.com",
        help="Allowed host for API requests (default: app.schoolinks.com)"
    )
    parser.add_argument(
        "--origin",
        default="https://app.schoolinks.com/course-catalog/katy-isd/course-offerings",
        help=(
            "Origin URL for resolving relative paths "
            "(default: https://app.schoolinks.com/course-catalog/katy-isd/course-offerings)"
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only discover and classify, don't crawl all data"
    )
    parser.add_argument(
        "--max-urls",
        type=int,
        default=20000,
        help="Maximum number of URLs to fetch (default: 20000)"
    )
    parser.add_argument(
        "--rate-limit-ms",
        type=int,
        default=150,
        help="Minimum delay between requests in milliseconds (default: 150)"
    )
    parser.add_argument(
        "--max-concurrency",
        type=int,
        default=6,
        help="Maximum concurrent requests (default: 6)"
    )
    
    args = parser.parse_args()
    
    if not args.har and not args.js:
        parser.error("At least one of --har or --js must be provided")
    
    # Run mapper
    asyncio.run(
        run_mapper(
            har_path=args.har,
            js_path=args.js,
            output_dir=Path(args.out),
            allow_host=args.allow_host,
            origin=args.origin,
            dry_run=args.dry_run,
            max_urls=args.max_urls,
            rate_limit_ms=args.rate_limit_ms,
            max_concurrency=args.max_concurrency
        )
    )
    
    logger.info("Mapper complete!")


if __name__ == "__main__":
    main()

