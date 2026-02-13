# Admin Course Import API

## Overview

Course imports in Planna are **admin-only operations** that can only be performed through the admin panel UI. Users upload a JSON file through the web interface, which sends it to the backend API for processing.

## Security

- ✅ Import endpoint requires admin authentication
- ✅ No command-line import scripts available
- ✅ All imports go through the backend server with proper validation
- ✅ Uses Supabase service role key (server-side only)

## API Endpoint

### POST `/api/admin/import-courses-from-json`

Import courses from uploaded JSON file.

#### Request

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <admin-jwt-token>
```

**Body:**
The raw JSON array of course objects from `step6_admin_upload.json`:

```json
[
  {
    "uuid": "421c4934-05cb-4364-b9b3-c5ebd043c506",
    "course_id": "0020",
    "name": "Study Hall",
    "credits": 0.0,
    "length": 2,
    "gpa": 4.0,
    "subject": {
      "name": "Local"
    },
    "elective": true,
    "tags": [],
    "grades_eligible": [...],
    "prerequisites": [],
    "corequisites": [],
    ...
  },
  ...
]
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Course import completed successfully",
  "stats": {
    "total": 615,
    "coursesCreated": 615,
    "coursesUpdated": 0,
    "tagsCreated": 1074,
    "eligibilityCreated": 3055,
    "relationshipsCreated": 247,
    "errors": 0,
    "errorDetails": []
  }
}
```

**Error (400/500):**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Frontend Integration

### Example: Admin Course Upload Component

```tsx
// src/pages/admin/AdminCourseUpload.tsx

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function AdminCourseUpload() {
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStats(null);

    try {
      // Read file content
      const text = await file.text();
      const coursesData = JSON.parse(text);

      // Validate it's an array
      if (!Array.isArray(coursesData)) {
        throw new Error('Invalid JSON: must be an array of courses');
      }

      // Send to backend API
      const response = await fetch('http://localhost:3001/api/admin/import-courses-from-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminToken()}`, // Your auth token
        },
        body: JSON.stringify(coursesData)
      });

      const result = await response.json();

      if (result.success) {
        setStats(result.stats);
        toast({
          title: 'Import Successful',
          description: `Imported ${result.stats.coursesCreated + result.stats.coursesUpdated} courses`,
        });
      } else {
        throw new Error(result.message);
      }

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Import Courses</h2>
      
      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id="course-upload"
        />
        <label htmlFor="course-upload">
          <Button disabled={uploading} asChild>
            <span>{uploading ? 'Importing...' : 'Upload JSON File'}</span>
          </Button>
        </label>
        <p className="mt-2 text-sm text-gray-500">
          Upload step6_admin_upload.json
        </p>
      </div>

      {stats && (
        <div className="mt-6 p-4 bg-green-50 rounded">
          <h3 className="font-semibold mb-2">Import Complete</h3>
          <ul className="text-sm space-y-1">
            <li>Total processed: {stats.total}</li>
            <li>Created: {stats.coursesCreated}</li>
            <li>Updated: {stats.coursesUpdated}</li>
            <li>Tags: {stats.tagsCreated}</li>
            <li>Eligibility records: {stats.eligibilityCreated}</li>
            <li>Relationships: {stats.relationshipsCreated}</li>
            {stats.errors > 0 && (
              <li className="text-red-600">Errors: {stats.errors}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## What Gets Imported

From each course in the JSON:

| JSON Field | Database Table | Notes |
|------------|----------------|-------|
| `course_id` | `courses.external_course_code` | Primary identifier |
| `uuid` | `courses.external_uuid` | Original UUID |
| `name` | `courses.name` | Course name |
| `credits` | `courses.credits` | Credit hours |
| `length` | `courses.length` | Course length |
| `gpa` | `courses.gpa_weight` | GPA weight |
| `subject.name` | `courses.subject` | Subject |
| `elective` | `courses.is_elective` | Elective flag |
| `tags[]` | `course_tags` | Multiple rows |
| `grades_eligible[]` | `course_eligibility` | Multiple rows |
| `prerequisites[]` | `course_relationships` | Type='prerequisite' |
| `corequisites[]` | `course_relationships` | Type='corequisite' |

## What Does NOT Get Imported

- **Course descriptions**: Left `NULL` - must be curated in admin UI
- **API metadata**: `source_endpoint`, `source_page_url` not stored (except in `raw_payload`)
- **School assignments**: Not in current JSON, will be added later

## Import Behavior

### Upsert Logic
- Existing courses (by `external_course_code`) are **updated**
- New courses are **created**
- Related data (tags, eligibility, relationships) is **deleted and recreated**

### Relationship Resolution
- Prerequisites/corequisites are resolved to `course_id` references
- If a referenced course doesn't exist, `related_course_id` is `NULL` but description is preserved

### Performance
- Imports run sequentially for data consistency
- Expected time: **5-10 minutes** for 615 courses
- Progress is logged to backend console

## Error Handling

The API handles errors gracefully:

1. **Invalid JSON**: Returns 400 with validation error
2. **Missing environment variables**: Returns 500 with configuration error
3. **Database errors**: Logged to `stats.errorDetails`, import continues for other courses
4. **Partial failures**: Import completes but returns error count in stats

## Testing the Import

### Using curl

```bash
curl -X POST http://localhost:3001/api/admin/import-courses-from-json \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d @data/output/step6_admin_upload.json
```

### Using Postman

1. Set method to **POST**
2. URL: `http://localhost:3001/api/admin/import-courses-from-json`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer <token>`
4. Body: **raw JSON** - paste contents of `step6_admin_upload.json`
5. Send

## Environment Setup

Ensure the backend server has these environment variables in `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Monitoring Imports

Import progress is logged to the backend console. Watch the server logs:

```bash
npm run dev:server
```

You'll see:
```
Starting course import with 615 courses
[1/615] ✨ Created: 0020 - Study Hall
[2/615] ✨ Created: 0073 - Academic Decathlon 2
...
Pass 1 complete: All courses imported
Creating course relationships...
Pass 2 complete: All relationships created
IMPORT SUMMARY
...
```

## Security Considerations

1. **Admin Authentication Required**: Protect this endpoint with admin-only middleware
2. **Rate Limiting**: Consider adding rate limits to prevent abuse
3. **File Size Limits**: Backend accepts up to 50MB JSON files
4. **Service Role Key**: Never expose to frontend - stays server-side only
5. **Audit Logging**: Log who performed imports and when

## Future Enhancements

- [ ] Add school data import when available
- [ ] Support incremental updates (only changed courses)
- [ ] Add import preview (validate before committing)
- [ ] Store import history/audit trail
- [ ] Support CSV format in addition to JSON
- [ ] Add rollback capability

---

**For Admin Panel Implementation**: Integrate the example code above into your admin UI at `/admin/courses/import`







