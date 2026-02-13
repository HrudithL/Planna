# Backend Server for Course Import

This server provides an API endpoint to execute the Python course import script from the admin panel.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables:**
   Create a `.env` file in the project root (or set environment variables):
   ```env
   SUPABASE_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   PORT=3001
   ```

3. **Start the server:**
   ```bash
   npm run dev:server
   ```

   Or run both frontend and backend together:
   ```bash
   npm run dev:all
   ```

## API Endpoints

### POST `/api/admin/import-courses`
Triggers the course import process. This will:
- Scrape courses from app.schoolinks.com
- Process and enrich the data
- Import to Supabase database

**Response:**
```json
{
  "success": true,
  "message": "Course import completed successfully",
  "output": "...",
  "error": null
}
```

### GET `/api/admin/import-status`
Gets the status of the last import.

**Response:**
```json
{
  "hasData": true,
  "totalCourses": 818,
  "statistics": { ... }
}
```

## Notes

- The import process can take 10-30 minutes depending on network speed
- Make sure `SUPABASE_DB_URL` is set in your environment
- The server will automatically detect the Python virtual environment in `data/venv/`
- If no venv is found, it will fall back to system Python

