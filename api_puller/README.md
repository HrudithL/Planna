# Course Data Import Utility

This utility folder contains tools for scraping, processing, and importing course data from app.schoolinks.com into the Supabase database.

## Quick Start

### 1. Setup Environment

```powershell
# Navigate to the utility folder
cd api_puller

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
playwright install chromium
```

### 2. Set Database Connection

Set the `SUPABASE_DB_URL` environment variable:

**Option A: PowerShell (temporary)**
```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
```

**Option B: Create `.env.local` file (recommended)**
```env
SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

To get your connection string:
1. Go to Supabase dashboard
2. Project Settings → Database
3. Connection string → URI mode
4. Copy and replace `[PASSWORD]` with your database password

### 3. Run Import

```powershell
python import_all.py
```

The script will:
- Scrape 1,500+ courses from app.schoolinks.com
- Add GPA weights (AP/KAP=5.0, Dual Credit=4.5, Regular=4.0)
- Parse and resolve prerequisites
- Collapse semester pairs (A/B, Fall/Spring) into full-year courses
- Save JSON files at each processing step
- Import everything to your Supabase database

## Output Files

All output is saved in the `output/` directory:

**Processing Steps:**
- `step1_raw_courses.json` - Raw scraped data
- `step2_with_gpa.json` - After GPA weights added
- `step3_with_prereqs.json` - After prerequisites parsed
- `step4_collapsed.json` - After collapsing semesters (~818 courses)
- `step5_final.json` - Final processed data ready for database

**Additional Data:**
- `metadata.json` - Subjects, tags, grade levels, endpoints
- `statistics.json` - Course counts, GPA distribution, etc.

## Using from Admin Panel

You can also trigger the import from the admin dashboard:

1. Start the backend server: `npm run dev:server`
2. Go to `/dashboard/admin` in the app
3. Click "Start Course Import" button

## API Surface Mapper

This utility uses the `api_surface_mapper` package to discover and crawl API endpoints. The mapper provides:

### Features

- **Network Discovery**: Capture API requests via Playwright browser automation
- **JS Bundle Analysis**: Extract API endpoint paths from frontend JavaScript bundles
- **Endpoint Classification**: Automatically classify endpoints (paginated, objects, arrays)
- **Safe Crawling**: GET-only requests with rate limiting and retry logic
- **Data Extraction**: Drain paginated endpoints and follow API links

### Manual API Discovery (Advanced)

If you need to manually discover API endpoints:

**Stage 1: Network Discovery**
```powershell
python -m api_surface_mapper.discover_network --url "https://app.schoolinks.com" --out network.har --interactive
```

**Stage 2: JS Discovery**
```powershell
python -m api_surface_mapper.discover_js --origin "https://app.schoolinks.com" --out js_endpoints.txt
```

**Stage 3: Classification and Crawling**
```powershell
python -m api_surface_mapper.mapper --har network.har --js js_endpoints.txt --out dump/ --dry-run
```

## Troubleshooting

**"SUPABASE_DB_URL environment variable not set"**
- Set the environment variable before running the script
- The database import will be skipped if not set, but JSON files will still be created

**"No items.ndjson found after scraping"**
- Check your network connection
- Verify app.schoolinks.com is accessible
- Check the `dump/` directory for any error files

**Import errors**
- Verify the database schema is already created
- Check that tables exist: courses, course_tags, course_eligible_grades, course_prerequisites
- Ensure your database user has INSERT permissions

**"playwright not found"**
- Run: `playwright install chromium`

**"ModuleNotFoundError"**
- Make sure you activated the virtual environment: `.\venv\Scripts\Activate.ps1`
- Reinstall requirements: `pip install -r requirements.txt`

## Directory Structure

```
api_puller/
├── import_all.py              # Main import script
├── requirements.txt           # Python dependencies
├── api_surface_mapper/        # API discovery package
│   ├── utils.py              # Shared utilities
│   ├── discover_network.py  # Network capture
│   ├── discover_js.py        # JS bundle analysis
│   ├── crawl_api.py         # Endpoint crawling
│   └── mapper.py             # Main orchestration
├── output/                    # Generated JSON files (gitignored)
├── dump/                      # API crawl data (gitignored)
└── venv/                      # Virtual environment (gitignored)
```

## Notes

- This is a utility subfolder of the main Planna project
- All generated files (output/, dump/, *.har, etc.) are gitignored
- The import process can take 10-30 minutes depending on network speed
- Make sure `SUPABASE_DB_URL` is set in your environment before importing
