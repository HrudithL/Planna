#!/usr/bin/env python3
"""
Simple Course Import Script
Scrapes courses, processes them (GPA, prereqs, collapsing), saves JSONs, imports to DB.

Usage:
    Set SUPABASE_DB_URL environment variable, then:
    python import_all.py
"""

import json
import os
import re
import sys
import asyncio
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse
import psycopg2
from psycopg2.extras import execute_batch

# Try to load from .env.local file if available
try:
    from dotenv import load_dotenv
    # Load .env.local from the project root directory (preferred)
    env_local_path = Path(__file__).parent / '.env.local'
    if env_local_path.exists():
        load_dotenv(env_local_path)
    else:
        # Fallback to .env if .env.local doesn't exist
        load_dotenv()
except ImportError:
    # dotenv not installed, that's okay
    pass

# Import existing scraper components
from api_surface_mapper.utils import HTTPClient, EndpointSet, keyed_endpoint
from api_surface_mapper.crawl_api import APICrawler

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# ============================================================================
# STEP 1: SCRAPE COURSE DATA
# ============================================================================

async def scrape_courses() -> dict:
    """Scrape all courses from app.schoolinks.com API."""
    print("\n" + "="*80)
    print("STEP 1: SCRAPING COURSE DATA")
    print("="*80)
    
    base_url = "https://app.schoolinks.com"
    
    # Start with the main course endpoint
    seed_urls = [
        f"{base_url}/api/v3/cp-courses/course/?district=katy-isd&has_grades=true&include_pages=false&offered_in_school=true&ordering=&page=1&page_size=100&requestable_by_student=true"
    ]
    
    print(f"Starting scrape from: {seed_urls[0]}")

    # Create HTTP client and crawler
    client = HTTPClient(
        allow_host="app.schoolinks.com",
        rate_limit_ms=150,
        max_concurrency=6,
        timeout=30.0,
    )
    crawler = APICrawler(
        client=client,
        output_dir=Path("dump"),
        max_urls=20000,
        origin=base_url,
    )
    
    # Crawl the known paginated DRF endpoint directly
    for url in seed_urls:
        key = keyed_endpoint(url)
        print(f"  Treating endpoint {key[0]} as paginated DRF list")
        await crawler.crawl_paginated_endpoint(url, key, None)
    
    await crawler.client.close()
    
    # Load the scraped items
    items_file = Path("dump/items.ndjson")
    if not items_file.exists():
        print("ERROR: No items.ndjson found after scraping!")
        sys.exit(1)
    
    raw_courses = []
    with open(items_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data = json.loads(line)
                course = data.get('item', {})
                course['source_endpoint'] = data.get('source_endpoint')
                course['source_page_url'] = data.get('source_page_url')
                raw_courses.append(course)
    
    print(f"\n[OK] Scraped {len(raw_courses)} courses")
    
    # Also load metadata
    metadata = {
        "subjects": set(),
        "tags": set(),
        "grade_levels": set(),
        "source_endpoints": set()
    }
    
    for course in raw_courses:
        if 'subject' in course and 'name' in course['subject']:
            metadata["subjects"].add(course['subject']['name'])
        for tag in course.get('tags', []):
            if 'symbol' in tag:
                metadata["tags"].add(tag['symbol'])
        for grade_info in course.get('grades_eligible', []):
            metadata["grade_levels"].add(grade_info.get('grade'))
        if course.get('source_endpoint'):
            metadata["source_endpoints"].add(course['source_endpoint'])
    
    # Convert sets to lists for JSON serialization
    metadata = {k: sorted(list(v)) for k, v in metadata.items()}
    
    # Save outputs
    result = {"courses": raw_courses, "count": len(raw_courses)}
    
    with open(OUTPUT_DIR / "step1_raw_courses.json", 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"  Saved: output/step1_raw_courses.json")
    
    with open(OUTPUT_DIR / "metadata.json", 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"  Saved: output/metadata.json")
    
    return result


# ============================================================================
# STEP 2: ADD GPA WEIGHTS
# ============================================================================

def add_gpa_weights(data: dict) -> dict:
    """Add GPA weights based on course type."""
    print("\n" + "="*80)
    print("STEP 2: ADDING GPA WEIGHTS")
    print("="*80)
    
    courses = data["courses"]
    
    for course in courses:
        name = course.get('name', '').upper()
        tags = [tag.get('symbol', '').upper() for tag in course.get('tags', [])]
        
        # Determine GPA weight
        if 'AP' in name or 'KAP' in name or any('AP' in tag or 'ADVANCED PLACEMENT' in tag for tag in tags):
            gpa = 5.0
        elif 'DUAL CREDIT' in name or 'DC' in name or any('DUAL CREDIT' in tag or tag == 'DC' for tag in tags):
            gpa = 4.5
        else:
            gpa = 4.0
        
        course['gpa'] = gpa
    
    # Count by GPA
    gpa_counts = defaultdict(int)
    for course in courses:
        gpa_counts[course['gpa']] += 1
    
    print(f"\n[OK] Added GPA weights:")
    for gpa in sorted(gpa_counts.keys(), reverse=True):
        print(f"  GPA {gpa}: {gpa_counts[gpa]} courses")
    
    result = {"courses": courses, "count": len(courses)}
    
    with open(OUTPUT_DIR / "step2_with_gpa.json", 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: output/step2_with_gpa.json")
    
    return result


# ============================================================================
# STEP 3: FIX PREREQUISITES
# ============================================================================

def normalize_name(name: str) -> str:
    """Normalize course name for matching."""
    return ' '.join(name.lower().split())


def simplify_course_name_for_prereq(name: str) -> str:
    """
    Simplify course names so prerequisite text is more likely to match.
    
    Examples:
        "AP Seminar A" -> "AP Seminar"
        "AP Seminar B" -> "AP Seminar"
        "Peer Assistance and Leadership 1A" -> "Peer Assistance and Leadership 1"
        "Personal Financial Literacy & Eco-SummerVir(sem1)" -> "Personal Financial Literacy & Eco-SummerVir"
    """
    # Remove trailing parentheses like (Fall), (Spring), (sem1), (sem2)
    name = re.sub(r'\(sem\s*[12]\)\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\(fall\)\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\(spring\)\s*$', '', name, flags=re.IGNORECASE)
    
    # Remove trailing section markers like " A", " B"
    name = re.sub(r'\s+[AB]\s*$', '', name)

    # Remove trailing A/B when attached to a number (e.g., "1A", "2B")
    name = re.sub(r'(\d)([AB])\s*$', r'\1', name)
    
    # Remove common virtual/summer suffixes in the name
    name = re.sub(r'\s*-\s*Vir(Sup|InstDay).*$', '', name, flags=re.IGNORECASE)
    
    return name.strip()


def fix_typos_for_matching(s: str) -> str:
    # Keep this tiny; expand only when we see real issues.
    s = re.sub(r"caclulus", "calculus", s, flags=re.IGNORECASE)
    s = re.sub(r"amination", "animation", s, flags=re.IGNORECASE)
    return s


def normalize_for_matching(s: str) -> str:
    """
    TS-inspired normalizer:
    - fix common typos
    - roman numerals -> digits (standalone tokens)
    - remove most parentheticals (but keep KAP as part of name)
    - remove leading '*'
    - normalize '&' -> 'and'
    - remove trailing A/B markers (with or without space, if last token)
    - collapse whitespace, lowercase
    - handle "and/or" -> "or"
    - handle "/or" -> "or"
    """
    s = (s or "").strip()
    s = fix_typos_for_matching(s)

    # Normalize "and/or" and "/or" to "or" for splitting
    s = re.sub(r'\s+and\s*/\s*or\s+', ' or ', s, flags=re.IGNORECASE)
    s = re.sub(r'\s*/\s*or\s+', ' or ', s, flags=re.IGNORECASE)

    # Roman numerals (standalone)
    s = re.sub(r"\bIV\b", "4", s, flags=re.IGNORECASE)
    s = re.sub(r"\bIII\b", "3", s, flags=re.IGNORECASE)
    s = re.sub(r"\bII\b", "2", s, flags=re.IGNORECASE)
    s = re.sub(r"\bI\b", "1", s, flags=re.IGNORECASE)

    # Keep (KAP) but strip other parentheticals
    s = re.sub(r"\s*\(KAP\)", " KAP", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*\(.*?\)", "", s)

    # Remove leading asterisk
    s = re.sub(r"^\*", "", s)

    # Remove virtual suffixes
    s = re.sub(r"\s*-\s*(VirSup|VirInstDay|SummerVir).*?$", "", s, flags=re.IGNORECASE)

    # Normalize & to and
    s = re.sub(r"\s*&\s*", " and ", s)

    # Trailing A/B, including attached to digits
    s = re.sub(r"\s+[AB]\s*$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"(\d)([AB])\s*$", r"\1", s, flags=re.IGNORECASE)

    s = " ".join(s.split()).strip().lower()

    # Abbreviation / phrase normalization (TS-inspired rules)
    # Map verbose AP language phrases to a canonical AP English Language label
    if "advanced placement language and composition" in s:
        s = s.replace("advanced placement language and composition", "ap english language")
    if "ap language and composition" in s:
        s = s.replace("ap language and composition", "ap english language")
    
    # Map "journalism" to "photojournalism" (Journalism 1)
    # This is a special case - if we see just "journalism" without a number, assume it's Journalism 1
    if s.strip() == "journalism":
        s = "photojournalism"
    
    return s

def is_non_course_requirement(text: str) -> bool:
    """Check if text is a non-course requirement (e.g., 'instructor approval', '2 credits of science')."""
    text_lower = text.lower().strip()
    non_course_phrases = [
        'credits of', 'credit of', 'permission of', 'approval of', 'consent of',
        'instructor approval', 'teacher approval', 'counselor approval',
        'department approval', 'prerequisite approval'
    ]
    return any(phrase in text_lower for phrase in non_course_phrases)

def fuzzy_course_lookup(text: str, course_index: Dict, course_list: List[dict]) -> Optional[str]:
    """
    Try to find a course code using multiple strategies:
    1. Exact normalized match in index
    2. Exact uppercase match in index
    3. Starts-with match (for course families like "Geometry" matching "Geometry A")
    4. Contains match for college codes (e.g., "ENGL 1301" or just "1301" in course name)
    5. Partial phrase match (for abbreviations like "Oral Int." -> "Oral Interpretation")
    6. Base subject match (e.g., "Athletics 1" matching "Boys Basketball 1A&B (Athletics 1)")
    """
    # Skip non-course requirements
    if is_non_course_requirement(text):
        return None
    
    normalized = normalize_for_matching(text)
    
    # Try exact match
    code = course_index.get(normalized) or course_index.get(text.upper())
    if code:
        return code
    
    # Try starts-with match (for course families)
    # E.g., "geometry" should match "geometry a" or "geometry kap a"
    # Also handles "athletics 1" matching "boys basketball 1a&b (athletics 1)"
    for key, val in course_index.items():
        if key.startswith(normalized + " ") or normalized.startswith(key + " "):
            return val
    
    # Try college course code pattern (e.g., "ENGL 1301")
    # Match both "ENGL 1301" and just "1301" in course names
    college_code_match = re.match(r'^([A-Z]{3,4})\s+(\d{4})$', text.strip(), re.IGNORECASE)
    if college_code_match:
        full_code = text.strip().upper()
        just_number = college_code_match.group(2)
        
        # Look for courses containing either the full code or just the number
        for course in course_list:
            course_name_upper = course.get('name', '').upper()
            if full_code in course_name_upper or just_number in course_name_upper:
                found_code = course.get('course_id')
                if found_code:
                    base, suffix = extract_base_code(found_code)
                    if base:
                        return base
    
    # Try partial phrase match (for abbreviations like "Oral Int." -> "Oral Interpretation")
    # Normalize the query and try to find courses containing key parts
    normalized_words = normalized.split()
    if len(normalized_words) >= 2:  # Even for 2-word phrases (e.g., "Oral Int.")
        # Try matching the most distinctive parts (skip common words like "and", "the", "of")
        skip_words = {'and', 'the', 'of', 'or', 'a', 'an', '1', '2', '3', '4'}
        key_words = [w for w in normalized_words if w not in skip_words and len(w) > 2]
        
        # Also include short but meaningful words (like "int" from "Oral Int.")
        if not key_words:
            key_words = [w for w in normalized_words if w not in skip_words and len(w) >= 2]
        
        if key_words:
            # Try to find courses where the normalized name contains significant key words
            # For abbreviations, we want at least 50% of key words to match
            min_matches = max(1, len(key_words) // 2) if len(key_words) > 2 else len(key_words)
            
            for course in course_list:
                course_name_norm = normalize_for_matching(course.get('name', ''))
                matches = sum(1 for word in key_words if word in course_name_norm)
                if matches >= min_matches:
                    found_code = course.get('course_id')
                    if found_code:
                        base, suffix = extract_base_code(found_code)
                        if base:
                            return base
    
    return None

def parse_prerequisites(prereq_text: str, course_index: Dict, course_list: List[dict]) -> List[dict]:
    """
    Parse prerequisite text into course references.
    Returns a list of prerequisite groups, where each group can have alternatives (OR) or requirements (AND).
    
    Format:
    [
      {
        "alternatives": [
          {"course_code": "0103", "text": "English 3", "resolved": true},
          {"course_code": "0113", "text": "AP English Language", "resolved": true}
        ],
        "requires_all": false  // false = any one is sufficient (OR), true = all must be met (AND)
      }
    ]
    """
    if not prereq_text or prereq_text.strip().lower() in ('n/a', 'none', ''):
        return []

    # Normalize the text first (handles "and/or", "/or", etc.)
    normalized_text = normalize_for_matching(prereq_text)
    
    # Check if there's an "or" in the original text (before normalization)
    # We need to check the original because normalization might have changed it
    has_or = bool(re.search(r'\s+or\s+', prereq_text, flags=re.IGNORECASE))
    has_and_or = bool(re.search(r'\s+and\s*/\s*or\s+', prereq_text, flags=re.IGNORECASE))
    has_slash_or = bool(re.search(r'/\s*or\s+', prereq_text, flags=re.IGNORECASE))
    has_comma = ',' in prereq_text
    has_and = bool(re.search(r'\s+and\s+', prereq_text, flags=re.IGNORECASE))
    
    # If there's no "or", "and/or", "/or", or comma, check for "and"
    if not (has_or or has_and_or or has_slash_or or has_comma):
        # If there's an "and", try splitting by "and" first (requires all)
        if has_and:
            and_chunks = re.split(r'\s+and\s+', prereq_text, flags=re.IGNORECASE)
            if len(and_chunks) > 1:
                and_results = []
                matched_any = False
                for and_chunk in and_chunks:
                    and_chunk = and_chunk.strip()
                    if not and_chunk:
                        continue
                    if is_non_course_requirement(and_chunk):
                        and_results.append({
                            "course_code": None,
                            "text": and_chunk,
                            "resolved": False
                        })
                        continue
                    code = fuzzy_course_lookup(and_chunk, course_index, course_list)
                    if code:
                        matched_any = True
                    and_results.append({
                        "course_code": code,
                        "text": and_chunk,
                        "resolved": code is not None
                    })
                if matched_any:
                    return [{
                        "alternatives": and_results,
                        "requires_all": True  # AND logic: all must be met
                    }]
        
        # No "and" splitting worked, try to match the whole string
        direct_code = fuzzy_course_lookup(prereq_text, course_index, course_list)
        if direct_code:
            return [{
                "alternatives": [{
                    "course_code": direct_code,
                    "text": prereq_text.strip(),
                    "resolved": True
                }],
                "requires_all": False
            }]
        else:
            # No match, return as unresolved text
            return [{
                "alternatives": [{
                    "course_code": None,
                    "text": prereq_text.strip(),
                    "resolved": False
                }],
                "requires_all": False
            }]

    # Split by OR (including "and/or" and "/or" which we normalized to "or")
    # Also handle comma-separated lists by treating commas as "or"
    # First, normalize separators to a consistent pattern
    text_to_split = prereq_text
    # Replace "and/or" and "/or" with " or " for consistent splitting
    text_to_split = re.sub(r'\s+and\s*/\s*or\s+', ' or ', text_to_split, flags=re.IGNORECASE)
    text_to_split = re.sub(r'/\s*or\s+', ' or ', text_to_split, flags=re.IGNORECASE)
    # Replace commas with " or " (treat comma-separated as alternatives)
    text_to_split = re.sub(r',\s*', ' or ', text_to_split)
    
    # Now split by "or"
    or_chunks = re.split(r'\s+or\s+', text_to_split, flags=re.IGNORECASE)
    
    alternatives = []
    for or_chunk in or_chunks:
        or_chunk = or_chunk.strip()
        if not or_chunk:
            continue
        
        # Clean up any trailing punctuation that might have been left
        or_chunk = re.sub(r'[.,;]+$', '', or_chunk).strip()
        
        # Skip if it's a non-course requirement
        if is_non_course_requirement(or_chunk):
            alternatives.append({
                "course_code": None,
                "text": or_chunk,
                "resolved": False
            })
            continue
        
        # Try matching the whole OR chunk first using fuzzy lookup
        course_code = fuzzy_course_lookup(or_chunk, course_index, course_list)
        
        if course_code:
            alternatives.append({
                "course_code": course_code,
                "text": or_chunk,
                "resolved": True
            })
            continue
        
        # Try smart AND splitting: split by "and" and try to match each part
        and_chunks = re.split(r'\s+and\s+', or_chunk, flags=re.IGNORECASE)
        
        if len(and_chunks) > 1:
            # Check if splitting helped: try to match each chunk using fuzzy lookup
            matched_any = False
            and_results = []
            for and_chunk in and_chunks:
                and_chunk = and_chunk.strip()
                if not and_chunk:
                    continue
                
                # Skip non-course requirements
                if is_non_course_requirement(and_chunk):
                    and_results.append({
                        "course_code": None,
                        "text": and_chunk,
                        "resolved": False
                    })
                    continue
                
                code = fuzzy_course_lookup(and_chunk, course_index, course_list)
                
                if code:
                    matched_any = True
                and_results.append({
                    "course_code": code,
                    "text": and_chunk,
                    "resolved": code is not None
                })
            
            # If we matched at least one AND chunk, treat the whole OR chunk as an AND group
            # But actually, if we're in an OR context, each alternative should be independent
            # So we'll add each AND result as a separate alternative (they're all part of the same OR group)
            if matched_any:
                # Add all AND results as alternatives (they're all part of the same OR group)
                alternatives.extend(and_results)
                continue
        
        # If AND splitting didn't help, keep original chunk unmatched
        alternatives.append({
            "course_code": None,
            "text": or_chunk,
            "resolved": False
        })
    
    # Return a single group with all alternatives (OR logic)
    if alternatives:
        return [{
            "alternatives": alternatives,
            "requires_all": False  # OR logic: any one is sufficient
        }]
    else:
        return []

def fix_prerequisites(data: dict) -> dict:
    """Parse prerequisites and attempt to resolve course references."""
    print("\n" + "="*80)
    print("STEP 3: FIXING PREREQUISITES")
    print("="*80)
    
    courses = data["courses"]
    
    # Build a map of base codes that should exist after collapsing,
    # so prereqs resolve to stable codes (e.g., 0080 instead of 0080A/0080B).
    base_to_suffixes: Dict[str, set] = defaultdict(set)
    for c in courses:
        cid = c.get("course_id")
        if not cid:
            continue
        base, suffix = extract_base_code(cid)
        if suffix:
            base_to_suffixes[base].add(suffix)

    bases_that_merge = set()
    for base, suffixes in base_to_suffixes.items():
        if suffixes == {"A", "B"} or suffixes == {"F", "S"}:
            bases_that_merge.add(base)

    # Build course index
    course_index: Dict[str, str] = {}
    for course in courses:
        code = course.get('course_id')
        name = course.get('name', '')
        if not code or not name:
            continue

        base, suffix = extract_base_code(code)
        stable_code = base if base in bases_that_merge else code
        
        # Index by full normalized name
        full_key = normalize_for_matching(name)
        course_index[full_key] = stable_code
        
        # Index by simplified base name (without A/B, (sem1), (sem2), etc.)
        simple_name = simplify_course_name_for_prereq(name)
        simple_key = normalize_for_matching(simple_name)
        if simple_key and simple_key not in course_index:
            course_index[simple_key] = stable_code
        
        # Index by raw course code
        course_index[code.upper()] = stable_code
        
        # Index by base subject name (e.g., "Geometry" for "Geometry A", "Geometry KAP A", etc.)
        # Extract the main subject by removing common prefixes/suffixes
        # Remove leading asterisk, virtual suffixes, A/B markers, and parenthetical content
        base_subject = re.sub(r'^\*', '', name)
        base_subject = re.sub(r'\s*-\s*(VirSup|VirInstDay|SummerVir).*$', '', base_subject, flags=re.IGNORECASE)
        base_subject = re.sub(r'\s+[AB]\s*$', '', base_subject)
        base_subject = re.sub(r'(\d)([AB])\s*$', r'\1', base_subject)
        
        # Extract parenthetical content (e.g., "(Athletics 1)") and index it separately
        parenthetical_matches = re.findall(r'\(([^)]+)\)', base_subject)
        for paren_content in parenthetical_matches:
            paren_key = normalize_for_matching(paren_content)
            if paren_key and paren_key not in course_index:
                # Only index if it's a meaningful phrase (not too short, not just numbers)
                if len(paren_key) > 3 and not paren_key.isdigit():
                    course_index[paren_key] = stable_code
        
        # Now remove all parentheticals for base subject indexing
        base_subject = re.sub(r'\s*\([^)]*\)', '', base_subject)
        base_subject = base_subject.strip()
        
        # Normalize and index (but only if it's different from simple_key to avoid duplicates)
        base_subject_key = normalize_for_matching(base_subject)
        if base_subject_key and base_subject_key != simple_key and base_subject_key not in course_index:
            # Only index if it's a meaningful base (not too short, not just numbers)
            if len(base_subject_key) > 3 and not base_subject_key.isdigit():
                course_index[base_subject_key] = stable_code

    # Parse prerequisites
    resolved_count = 0
    text_only_count = 0
    
    for course in courses:
        prereq_text = course.get('prereq_description')
        coreq_text = course.get('coreq_description')
        
        course['prerequisites'] = []
        course['corequisites'] = []
        
        if prereq_text:
            parsed_groups = parse_prerequisites(prereq_text, course_index, courses)
            course['prerequisites'] = parsed_groups
            # Count resolved/unresolved for statistics
            for group in parsed_groups:
                for alt in group.get('alternatives', []):
                    if alt.get('resolved'):
                        resolved_count += 1
                    else:
                        text_only_count += 1
        
        if coreq_text:
            parsed_groups = parse_prerequisites(coreq_text, course_index, courses)
            course['corequisites'] = parsed_groups
            # Count resolved/unresolved for statistics
            for group in parsed_groups:
                for alt in group.get('alternatives', []):
                    if alt.get('resolved'):
                        resolved_count += 1
                    else:
                        text_only_count += 1
    
    print(f"\n[OK] Parsed prerequisites:")
    print(f"  Resolved to course codes: {resolved_count}")
    print(f"  Text-only (not resolved): {text_only_count}")
    
    result = {"courses": courses, "count": len(courses)}
    
    with open(OUTPUT_DIR / "step3_with_prereqs.json", 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: output/step3_with_prereqs.json")
    
    return result


# ============================================================================
# STEP 4: COLLAPSE SEMESTER COURSES
# ============================================================================

def extract_base_code(course_code: str) -> Tuple[str, Optional[str]]:
    """Extract base code and suffix (A/B/F/S)."""
    if course_code.endswith('A') or course_code.endswith('B'):
        return (course_code[:-1], course_code[-1])
    if course_code.endswith('F') or course_code.endswith('S'):
        return (course_code[:-1], course_code[-1])
    return (course_code, None)

def clean_name(name: str) -> str:
    """Remove A/B, Fall/Spring markers from course name."""
    # Remove leading asterisk
    name = re.sub(r'^\*', '', name)
    
    # Normalize dash spacing for virtual suffixes (ensure space before dash)
    # Fixes cases like "AP Computer Science- VirSup" -> "AP Computer Science - VirSup"
    name = re.sub(r'(\S)-(\s*)(VirSup|VirInstDay|SummerVir)', r'\1 - \3', name, flags=re.IGNORECASE)
    
    # Remove parenthetical (A) or (B) markers that appear before virtual suffixes
    # This handles cases like "AP Computer Science A (A) - VirSup" -> "AP Computer Science A - VirSup"
    name = re.sub(r'\s*\([AB]\)\s*(?=\s*-\s*(VirSup|VirInstDay|SummerVir))', '', name, flags=re.IGNORECASE)
    
    # Remove trailing A/B markers that appear before virtual suffixes
    # This handles cases like "Geometry KAP A - VirSup" -> "Geometry KAP - VirSup"
    name = re.sub(r'\s+[AB]\s*(?=\s*-\s*(VirSup|VirInstDay|SummerVir))', '', name, flags=re.IGNORECASE)
    
    # Remove Fall/Spring markers
    name = re.sub(r'\s*\(Fall\)\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\(Spring\)\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\(sem\s*[12]\)\s*$', '', name, flags=re.IGNORECASE)
    
    # Remove parenthetical (A) or (B) markers at the end (for courses without virtual suffixes)
    # This handles cases like "AP Computer Science A (A)" -> "AP Computer Science A"
    name = re.sub(r'\s*\([AB]\)\s*$', '', name)
    
    # Remove trailing A/B markers at the end (for courses without virtual suffixes)
    # This handles cases like "Geometry KAP A" -> "Geometry KAP"
    name = re.sub(r'\s+[AB]\s*$', '', name)
    
    # Handle legacy patterns with parentheses in virtual suffixes
    name = re.sub(r'\s+-\s+VirSup\(Fall\)', ' - VirSup', name)
    name = re.sub(r'\s+-\s+VirInstDay\(Fall\)', ' - VirInstDay', name)
    
    return name.strip()

def collapse_semesters(data: dict) -> dict:
    """Collapse A/B and Fall/Spring course pairs into full-year courses."""
    print("\n" + "="*80)
    print("STEP 4: COLLAPSING SEMESTER COURSES")
    print("="*80)
    
    courses = data["courses"]
    
    # Group by base code (with special handling for (sem1)/(sem2) name patterns)
    by_base = defaultdict(list)
    for course in courses:
        course_id = course['course_id']
        base, suffix = extract_base_code(course_id)

        # Special case: names ending with (sem1)/(sem2) and IDs like ...S1/...S2
        m = re.search(r'\(sem\s*([12])\)\s*$', course.get('name', ''), re.IGNORECASE)
        if m:
            # Treat last character as 1/2 suffix, strip it from base
            if course_id and len(course_id) > 1:
                base = course_id[:-1]
                suffix = m.group(1)

        by_base[base].append((course, suffix))
    
    collapsed = []
    
    for base, course_list in by_base.items():
        if len(course_list) == 1:
            # Singleton, just clean the name
            course, _ = course_list[0]
            course['name'] = clean_name(course['name'])
            collapsed.append(course)
        
        elif len(course_list) == 2:
            suffixes = {s for _, s in course_list}
            
            if suffixes == {'A', 'B'} or suffixes == {'F', 'S'} or suffixes == {'1', '2'}:
                # Merge them
                c1, _ = course_list[0]
                c2, _ = course_list[1]
                
                merged = {
                    'uuid': c1['uuid'],
                    'course_id': base,
                    'name': clean_name(c1['name']),
                    'credits': c1.get('credits', 0) + c2.get('credits', 0),
                    'length': c1.get('length', 1) + c2.get('length', 1),
                    'gpa': c1.get('gpa', 4.0),
                    'subject': c1.get('subject'),
                    'description': c1.get('description') or c2.get('description') or '',
                    'requirement_notes': c1.get('requirement_notes') or c2.get('requirement_notes'),
                    'elective': c1.get('elective', False),
                    'source_endpoint': c1.get('source_endpoint'),
                    'source_page_url': c1.get('source_page_url'),
                    'prereq_description': c1.get('prereq_description') or c2.get('prereq_description'),
                    'coreq_description': c1.get('coreq_description') or c2.get('coreq_description'),
                }
                
                # Union tags
                tag_map = {}
                for tag in c1.get('tags', []) + c2.get('tags', []):
                    symbol = tag.get('symbol')
                    if symbol and symbol not in tag_map:
                        tag_map[symbol] = tag
                merged['tags'] = list(tag_map.values())
                
                # Union grades
                grades_map = {}
                for g in c1.get('grades_eligible', []) + c2.get('grades_eligible', []):
                    grade = g['grade']
                    if grade not in grades_map:
                        grades_map[grade] = g
                    else:
                        # Merge terms
                        existing_terms = {t['academic_term'] for t in grades_map[grade].get('academic_term_offered', [])}
                        for term in g.get('academic_term_offered', []):
                            if term['academic_term'] not in existing_terms:
                                grades_map[grade].setdefault('academic_term_offered', []).append(term)
                # Ensure merged grades are offered in both Semester 1 and 2
                for grade, info in grades_map.items():
                    terms = info.get('academic_term_offered', [])
                    existing_terms = {t.get('academic_term') for t in terms if isinstance(t, dict)}
                    # Always include both academic_term 1 and 2
                    for term_num, term_name in [(1, "Semester 1"), (2, "Semester 2")]:
                        if term_num not in existing_terms:
                            terms.append({
                                "academic_term": term_num,
                                "name": term_name,
                                "can_plan": True,
                            })
                    info['academic_term_offered'] = terms

                merged['grades_eligible'] = list(grades_map.values())
                
                # Merge prerequisites/corequisites
                merged['prerequisites'] = c1.get('prerequisites', []) + c2.get('prerequisites', [])
                merged['corequisites'] = c1.get('corequisites', []) + c2.get('corequisites', [])
                
                collapsed.append(merged)
            else:
                # Not a proper pair
                for course, _ in course_list:
                    course['name'] = clean_name(course['name'])
                    collapsed.append(course)
        else:
            # More than 2, keep separately
            for course, _ in course_list:
                course['name'] = clean_name(course['name'])
                collapsed.append(course)
    
    print(f"\n[OK] Collapsed courses:")
    print(f"  Before: {len(courses)} courses")
    print(f"  After: {len(collapsed)} courses")
    print(f"  Merged: {len(courses) - len(collapsed)} pairs")
    
    result = {"courses": collapsed, "count": len(collapsed)}
    
    with open(OUTPUT_DIR / "step4_collapsed.json", 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: output/step4_collapsed.json")
    
    return result


# ============================================================================
# STEP 5: PREPARE FINAL DATA
# ============================================================================

def prepare_final(data: dict) -> dict:
    """Organize final data and generate statistics."""
    print("\n" + "="*80)
    print("STEP 5: PREPARING FINAL DATA")
    print("="*80)
    
    courses = data["courses"]
    
    # Organize by grade levels
    by_grade = defaultdict(list)
    for course in courses:
        for grade_info in course.get('grades_eligible', []):
            grade = grade_info.get('grade')
            if grade:
                by_grade[grade].append(course['course_id'])
    
    # Calculate statistics
    stats = {
        "total_courses": len(courses),
        "gpa_distribution": {},
        "subject_distribution": {},
        "grade_distribution": {grade: len(codes) for grade, codes in by_grade.items()},
        "credits_distribution": {},
        "tag_distribution": {},
    }
    
    for course in courses:
        # GPA
        gpa = course.get('gpa', 4.0)
        stats["gpa_distribution"][str(gpa)] = stats["gpa_distribution"].get(str(gpa), 0) + 1
        
        # Subject
        subject = course.get('subject', {}).get('name', 'Unknown')
        stats["subject_distribution"][subject] = stats["subject_distribution"].get(subject, 0) + 1
        
        # Credits
        credits = course.get('credits', 0)
        stats["credits_distribution"][str(credits)] = stats["credits_distribution"].get(str(credits), 0) + 1
        
        # Tags
        for tag in course.get('tags', []):
            symbol = tag.get('symbol')
            if symbol:
                stats["tag_distribution"][symbol] = stats["tag_distribution"].get(symbol, 0) + 1
    
    print(f"\n[OK] Final statistics:")
    print(f"  Total courses: {stats['total_courses']}")
    print(f"  GPA 5.0: {stats['gpa_distribution'].get('5.0', 0)}")
    print(f"  GPA 4.5: {stats['gpa_distribution'].get('4.5', 0)}")
    print(f"  GPA 4.0: {stats['gpa_distribution'].get('4.0', 0)}")
    print(f"  Subjects: {len(stats['subject_distribution'])}")
    print(f"  Tags: {len(stats['tag_distribution'])}")
    
    result = {
        "courses": courses,
        "count": len(courses),
        "organized_by_grade": dict(by_grade)
    }
    
    with open(OUTPUT_DIR / "step5_final.json", 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: output/step5_final.json")
    
    with open(OUTPUT_DIR / "statistics.json", 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    print(f"  Saved: output/statistics.json")
    
    return result


# ============================================================================
# STEP 6: IMPORT TO DATABASE
# ============================================================================

def import_to_database(data: dict) -> None:
    """Import courses to Supabase database with new/not-offered tracking."""
    print("\n" + "="*80)
    print("STEP 6: IMPORTING TO DATABASE")
    print("="*80)
    
    conn_str = os.environ.get('SUPABASE_DB_URL')
    if not conn_str:
        print("\n" + "="*80)
        print("ERROR: SUPABASE_DB_URL environment variable not set!")
        print("="*80)
        print("\nTo set the database connection URL, use one of these methods:\n")
        print("1. Create a .env.local file in the project root (RECOMMENDED):")
        print('   SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres')
        print("\n2. PowerShell (temporary for current session):")
        print('   $env:SUPABASE_DB_URL = "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"')
        print("\n3. Create a .env file in the project root (fallback):")
        print('   SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres')
        print("\n4. Windows Command Prompt (temporary for current session):")
        print('   set SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres')
        print("\nTo get your connection string:")
        print("  1. Go to your Supabase dashboard")
        print("  2. Project Settings -> Database")
        print("  3. Connection string -> URI mode")
        print("  4. Copy and replace [PASSWORD] with your database password")
        print("\n" + "="*80)
        print("Skipping database import. JSON files are still available in the output/ directory.")
        print("="*80 + "\n")
        sys.exit(1)  # Exit with error code if database URL is not set
    
    # Clean the connection string - remove query parameters that psycopg2 doesn't like
    # Supabase connection strings sometimes include ?pgbouncer=true or other params
    original_conn_str = conn_str
    try:
        # Parse the URL to properly remove query parameters and fragments
        parsed = urlparse(conn_str)
        if parsed.query or parsed.fragment:
            # Reconstruct URL without query parameters and fragments
            clean_parsed = parsed._replace(query='', fragment='')
            conn_str = urlunparse(clean_parsed)
            print(f"Note: Removed query parameters and fragments from connection string")
    except Exception as e:
        # Fallback: simple string manipulation if URL parsing fails
        if '?' in conn_str:
            conn_str = conn_str.split('?')[0]
        if '#' in conn_str:
            conn_str = conn_str.split('#')[0]
        print(f"Note: Used fallback method to clean connection string")
    
    courses = data["courses"]
    
    print(f"Connecting to database...")
    print(f"Connection string format: {'postgresql://' if conn_str.startswith('postgresql://') else 'other'}")
    try:
        conn = psycopg2.connect(conn_str)
        print(f"Successfully connected to database")
    except psycopg2.OperationalError as e:
        error_msg = str(e)
        print(f"\n" + "="*80)
        print("ERROR: Failed to connect to database")
        print("="*80)
        print(f"Error: {error_msg}")
        if 'pgbouncer' in error_msg.lower() or 'query parameter' in error_msg.lower():
            print(f"\nThis error suggests query parameters in the connection string.")
            print(f"Original connection string had query params: {'?' in original_conn_str}")
            print(f"Cleaned connection string: {conn_str.split('@')[0] if '@' in conn_str else 'N/A'}@...")
        print(f"\nConnection string (password hidden): {conn_str.split('@')[0] if '@' in conn_str else 'N/A'}@...")
        print("\nCommon issues:")
        print("  1. Invalid connection string format")
        print("  2. Database password is incorrect")
        print("  3. Database server is not accessible")
        print("  4. Connection string contains unsupported query parameters")
        print("  5. Network/firewall blocking the connection")
        print("="*80)
        raise
    cursor = conn.cursor()
    
    try:
        # Ensure schema has required columns for tracking
        print("Checking/updating database schema...")
        try:
            cursor.execute("""
                ALTER TABLE courses 
                ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS not_offered_this_semester BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE
            """)
            conn.commit()
            print("  [OK] Schema updated")
        except Exception as e:
            print(f"  [WARN] Schema update: {e}")
            conn.rollback()
        
        # Get all existing courses from database
        print("Querying existing courses from database...")
        cursor.execute("SELECT course_code FROM courses")
        existing_course_codes = {row[0] for row in cursor.fetchall()}
        print(f"  Found {len(existing_course_codes)} existing courses in database")
        
        # Get course codes from new scrape
        new_course_codes = {course['course_id'] for course in courses}
        
        # Identify new courses and courses not offered this semester
        courses_to_add = new_course_codes - existing_course_codes
        courses_not_offered = existing_course_codes - new_course_codes
        
        print(f"  New courses to add: {len(courses_to_add)}")
        print(f"  Courses not offered this semester: {len(courses_not_offered)}")
        
        # Mark courses not offered this semester
        if courses_not_offered:
            print(f"Marking {len(courses_not_offered)} courses as not offered this semester...")
            cursor.execute("""
                UPDATE courses 
                SET not_offered_this_semester = TRUE,
                    is_new = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE course_code = ANY(%s)
            """, (list(courses_not_offered),))
            conn.commit()
            print(f"  [OK] Marked {cursor.rowcount} courses as not offered")
        
        # Reset flags for courses that are found again (were not offered, now are)
        courses_found_again = existing_course_codes & new_course_codes
        if courses_found_again:
            print(f"Resetting flags for {len(courses_found_again)} courses found again...")
            cursor.execute("""
                UPDATE courses 
                SET not_offered_this_semester = FALSE,
                    is_new = FALSE,
                    last_seen_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE course_code = ANY(%s)
            """, (list(courses_found_again),))
            conn.commit()
            print(f"  [OK] Reset flags for {cursor.rowcount} courses")
        
        # Insert/update courses
        print(f"Inserting/updating {len(courses)} courses...")
        course_id_map = {}
        new_count = 0
        updated_count = 0
        
        for course in courses:
            term = "Full Year" if course.get('length', 1) >= 2 else "Semester 1"
            is_new_course = course['course_id'] in courses_to_add
            
            cursor.execute("""
                INSERT INTO courses (
                    uuid, course_code, course_name, credits, gpa, subject, term,
                    prerequisite_text, corequisite_text, enrollment_notes, course_description,
                    elective, length, source_endpoint, source_page_url,
                    is_new, not_offered_this_semester, last_seen_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (course_code) DO UPDATE SET
                    uuid = EXCLUDED.uuid,
                    course_name = EXCLUDED.course_name,
                    credits = EXCLUDED.credits,
                    gpa = EXCLUDED.gpa,
                    subject = EXCLUDED.subject,
                    term = EXCLUDED.term,
                    prerequisite_text = EXCLUDED.prerequisite_text,
                    corequisite_text = EXCLUDED.corequisite_text,
                    enrollment_notes = EXCLUDED.enrollment_notes,
                    course_description = EXCLUDED.course_description,
                    elective = EXCLUDED.elective,
                    length = EXCLUDED.length,
                    source_endpoint = EXCLUDED.source_endpoint,
                    source_page_url = EXCLUDED.source_page_url,
                    is_new = EXCLUDED.is_new,
                    not_offered_this_semester = EXCLUDED.not_offered_this_semester,
                    last_seen_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, course_code
            """, (
                course.get('uuid'),
                course['course_id'],
                course['name'],
                course.get('credits', 0),
                course.get('gpa', 4.0),
                course.get('subject', {}).get('name', 'Unknown'),
                term,
                course.get('prereq_description'),
                course.get('coreq_description'),
                course.get('requirement_notes'),
                course.get('description', ''),
                course.get('elective', False),
                course.get('length', 1),
                course.get('source_endpoint'),
                course.get('source_page_url'),
                is_new_course,  # is_new
                False  # not_offered_this_semester (reset for courses found in new scrape)
            ))
            result = cursor.fetchone()
            course_id_map[result[1]] = result[0]
            if is_new_course:
                new_count += 1
            else:
                updated_count += 1
        
        conn.commit()
        print(f"  [OK] Inserted {new_count} new courses, updated {updated_count} existing courses")
        
        # Clear and re-insert tags for all courses found in new scrape (to ensure they're up to date)
        print(f"Updating course tags...")
        # Delete existing tags for courses found in new scrape
        if course_id_map:
            course_ids = list(course_id_map.values())
            # Use unnest with explicit UUID casting to fix "operator does not exist: uuid = text" error
            # This works because unnest properly handles the array type conversion
            cursor.execute("""
                DELETE FROM course_tags 
                WHERE course_id IN (SELECT unnest(%s::uuid[]))
            """, (course_ids,))
        
        tag_count = 0
        for course in courses:
            course_id = course_id_map.get(course['course_id'])
            if not course_id:
                continue
            
            for tag in course.get('tags', []):
                symbol = tag.get('symbol')
                if symbol:
                    cursor.execute("""
                        INSERT INTO course_tags (course_id, tag, tag_uuid)
                        VALUES (%s, %s, %s)
                    """, (course_id, symbol, tag.get('uuid')))
                    tag_count += 1
        
        conn.commit()
        print(f"  [OK] Updated {tag_count} tag relationships")
        
        # Clear and re-insert eligible grades for all courses found in new scrape
        print(f"Updating eligible grades...")
        if course_id_map:
            course_ids = list(course_id_map.values())
            # Use unnest with explicit UUID casting to fix "operator does not exist: uuid = text" error
            cursor.execute("""
                DELETE FROM course_eligible_grades 
                WHERE course_id IN (SELECT unnest(%s::uuid[]))
            """, (course_ids,))
        
        grade_count = 0
        for course in courses:
            course_id = course_id_map.get(course['course_id'])
            if not course_id:
                continue
            
            for grade_info in course.get('grades_eligible', []):
                grade = grade_info.get('grade')
                for term in grade_info.get('academic_term_offered', []):
                    cursor.execute("""
                        INSERT INTO course_eligible_grades (
                            course_id, grade, academic_term, academic_term_name, can_plan
                        ) VALUES (%s, %s, %s, %s, %s)
                    """, (
                        course_id,
                        grade,
                        term.get('academic_term'),
                        term.get('name'),
                        term.get('can_plan', True)
                    ))
                    grade_count += 1
        
        conn.commit()
        print(f"  [OK] Updated {grade_count} grade eligibility records")
        
        # Clear and re-insert prerequisites for all courses found in new scrape
        print(f"Updating prerequisites...")
        if course_id_map:
            course_ids = list(course_id_map.values())
            # Use unnest with explicit UUID casting to fix "operator does not exist: uuid = text" error
            cursor.execute("""
                DELETE FROM course_prerequisites 
                WHERE course_id IN (SELECT unnest(%s::uuid[]))
            """, (course_ids,))
        
        prereq_count = 0
        for course in courses:
            course_id = course_id_map.get(course['course_id'])
            if not course_id:
                continue
            
            # Handle new format: prerequisites are groups with alternatives
            for prereq_group in course.get('prerequisites', []):
                alternatives = prereq_group.get('alternatives', [])
                requires_all = prereq_group.get('requires_all', False)
                
                for alt in alternatives:
                    prereq_course_id = course_id_map.get(alt.get('course_code')) if alt.get('course_code') else None
                    # Store the group info in the text if it's an OR group (requires_all=False)
                    # This way we preserve the OR logic in the database
                    text = alt.get('text', '')
                    if not requires_all and len(alternatives) > 1:
                        # Mark as OR group by prefixing with "OR: " (we'll parse this later if needed)
                        text = f"OR: {text}"
                    
                    cursor.execute("""
                        INSERT INTO course_prerequisites (
                            course_id, prerequisite_course_id, prerequisite_text, is_corequisite
                        ) VALUES (%s, %s, %s, %s)
                    """, (course_id, prereq_course_id, text, False))
                    prereq_count += 1
            
            # Handle corequisites (same format)
            for coreq_group in course.get('corequisites', []):
                alternatives = coreq_group.get('alternatives', [])
                requires_all = coreq_group.get('requires_all', False)
                
                for alt in alternatives:
                    coreq_course_id = course_id_map.get(alt.get('course_code')) if alt.get('course_code') else None
                    text = alt.get('text', '')
                    if not requires_all and len(alternatives) > 1:
                        text = f"OR: {text}"
                    
                    cursor.execute("""
                        INSERT INTO course_prerequisites (
                            course_id, prerequisite_course_id, prerequisite_text, is_corequisite
                        ) VALUES (%s, %s, %s, %s)
                    """, (course_id, coreq_course_id, text, True))
                    prereq_count += 1
        
        conn.commit()
        print(f"  [OK] Updated {prereq_count} prerequisite relationships")
        
        # Print summary
        print(f"\n" + "="*80)
        print("IMPORT SUMMARY")
        print("="*80)
        print(f"  Total courses processed: {len(courses)}")
        print(f"  New courses added: {new_count}")
        print(f"  Existing courses updated: {updated_count}")
        print(f"  Courses not offered this semester: {len(courses_not_offered)}")
        print(f"  Tags updated: {tag_count}")
        print(f"  Grade eligibilities updated: {grade_count}")
        print(f"  Prerequisites/corequisites updated: {prereq_count}")
        print("="*80)
        print(f"\n[OK] Database import complete!")
        
    except Exception as e:
        print(f"\nERROR during database import: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.rollback()
        sys.exit(1)  # Exit with error code on database import failure
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()


# ============================================================================
# MAIN
# ============================================================================

async def main():
    try:
        print("\n" + "="*80)
        print("SIMPLE COURSE IMPORT SCRIPT")
        print("="*80)
        print("\nThis script will:")
        print("  1. Scrape courses from app.schoolinks.com")
        print("  2. Add GPA weights (AP/KAP=5.0, Dual Credit=4.5, Regular=4.0)")
        print("  3. Parse and resolve prerequisites")
        print("  4. Collapse semester pairs (A/B, Fall/Spring) into full-year courses")
        print("  5. Prepare final data and statistics")
        print("  6. Import everything to Supabase database")
        print("\nJSON files will be saved at each step in the output/ directory.")
        print("="*80)
        
        # Run all steps
        data = await scrape_courses()
        data = add_gpa_weights(data)
        data = fix_prerequisites(data)
        data = collapse_semesters(data)
        data = prepare_final(data)
        import_to_database(data)
        
        print("\n" + "="*80)
        print("ALL STEPS COMPLETE!")
        print("="*80)
        print(f"\nOutput files saved in: {OUTPUT_DIR.absolute()}")
        print("\nCheck the following files:")
        print("  - step1_raw_courses.json (raw scraped data)")
        print("  - step2_with_gpa.json (with GPA weights)")
        print("  - step3_with_prereqs.json (with parsed prerequisites)")
        print("  - step4_collapsed.json (with collapsed semesters)")
        print("  - step5_final.json (final processed data)")
        print("  - metadata.json (subjects, tags, etc.)")
        print("  - statistics.json (counts and distributions)")
        print("="*80 + "\n")
    except Exception as e:
        print(f"\n" + "="*80)
        print("FATAL ERROR")
        print("="*80)
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        print("="*80 + "\n")
        sys.exit(1)  # Exit with error code on any fatal error

if __name__ == '__main__':
    asyncio.run(main())

