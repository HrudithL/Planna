# Planna Database Import Guide

This guide explains how to import course data into the Planna database.

## Overview

The Planna database has been redesigned to focus on the core needs of the application:
- **Courses** with rich metadata (credits, GPA weight, subject, etc.)
- **Prerequisites and Corequisites** via the `course_relationships` table
- **Grade/Term Eligibility** for course planning
- **Tags** for categorization
- **Schools** (structure ready, data to be added later)
- **User Plans** and **Preset Plans**

## Database Schema

The new schema includes these main tables:

### Course Data
- `courses` - Main course catalog
- `course_tags` - Tags/categories for courses
- `course_relationships` - Prerequisites, corequisites, recommendations
- `course_eligibility` - Which grades/terms can take each course

### School Data (Future)
- `schools` - School/campus information
- `school_courses` - Which schools offer which courses

### Planning Data
- `plans` - User plans and preset templates
- `plan_courses` - Courses within a plan

## Import Process

### Prerequisites

1. **Environment Variables**

   Create a `.env` file in the project root with:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   ⚠️ **Important**: Use the **service role key**, not the anon key, as the import script needs admin permissions.

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Prepare Data**

   Ensure `data/output/step6_admin_upload.json` exists and contains your course data.

### Running the Import

```bash
npm run import:courses
```

This will:
1. Read all courses from `step6_admin_upload.json`
2. Upsert each course into the `courses` table
3. Import all tags into `course_tags`
4. Import grade/term eligibility into `course_eligibility`
5. Create prerequisite and corequisite relationships in `course_relationships`

### What Gets Imported

From each course in the JSON:

| JSON Field | Database Table | Database Column | Notes |
|------------|----------------|-----------------|-------|
| `course_id` | `courses` | `external_course_code` | Primary identifier |
| `uuid` | `courses` | `external_uuid` | Original UUID from source |
| `name` | `courses` | `name` | Course name |
| `credits` | `courses` | `credits` | Credit hours |
| `length` | `courses` | `length` | Course length (semesters) |
| `gpa` | `courses` | `gpa_weight` | GPA weight |
| `subject.name` | `courses` | `subject` | Subject category |
| `elective` | `courses` | `is_elective` | Elective flag |
| `tags[].symbol` | `course_tags` | `tag` | Course tags |
| `grades_eligible` | `course_eligibility` | Multiple rows | Grade/term combos |
| `prerequisites` | `course_relationships` | Multiple rows | Prerequisite links |
| `corequisites` | `course_relationships` | Multiple rows | Corequisite links |

### What Does NOT Get Imported

- **Course descriptions**: The `description` field in the database is intentionally left `NULL`. Descriptions should be curated within the Planna app, not imported from the API.
- **API metadata**: Fields like `source_endpoint` and `source_page_url` are not stored (except in `raw_payload` for reference).
- **School assignments**: School data is not yet available in the JSON.

## Import Behavior

### Upsert Logic

The import uses **upsert** behavior:
- If a course with the same `external_course_code` exists, it will be **updated**
- If it's new, it will be **created**
- Related data (tags, eligibility, relationships) is **deleted and recreated** on each import to ensure consistency

### Relationship Resolution

Prerequisites and corequisites reference other courses by `course_code`. The import script:
1. First imports all courses and builds a mapping of `course_code` → `course_id`
2. Then creates relationships using the resolved `course_id` values
3. If a referenced course doesn't exist, the relationship is still created with `related_course_id = NULL` and the text description preserved

## Monitoring the Import

The import script provides detailed progress output:

```
🚀 Starting course import from step6_admin_upload.json

📖 Reading JSON from: C:\...\data\output\step6_admin_upload.json
✅ Loaded 615 courses from JSON

📦 Importing courses...

[1/615] ✨ Created: 0020 - Study Hall
[2/615] ✨ Created: 0073 - Academic Decathlon 2
[3/615] ✨ Created: 0075 - AP Seminar
...

📦 Pass 1 complete: All courses imported

🔗 Creating course relationships...

[1/615] ⚠️  Skipping relationships for 0020 (no prerequisites)
[2/615] ⚠️  Skipping relationships for 0073 (no prerequisites)
[3/615] ✅ Created 2 relationships for 0075
...

═══════════════════════════════════════════════════════════
                   IMPORT SUMMARY                          
═══════════════════════════════════════════════════════════
Total courses processed:      615
  - Courses created:          615
  - Courses updated:          0
Tags created:                 1074
Eligibility records created:  3055
Relationships created:        247
Errors:                       0
═══════════════════════════════════════════════════════════

✅ Import complete!
```

## Verifying the Import

After import, verify the data in Supabase:

1. **Check course count**:
   ```sql
   SELECT COUNT(*) FROM courses;
   ```

2. **Check tags**:
   ```sql
   SELECT COUNT(*) FROM course_tags;
   ```

3. **Check eligibility**:
   ```sql
   SELECT COUNT(*) FROM course_eligibility;
   ```

4. **Check relationships**:
   ```sql
   SELECT COUNT(*) FROM course_relationships;
   ```

5. **Sample a course with prerequisites**:
   ```sql
   SELECT 
     c.external_course_code,
     c.name,
     cr.relationship_type,
     cr.description,
     related.external_course_code AS related_code,
     related.name AS related_name
   FROM courses c
   LEFT JOIN course_relationships cr ON c.id = cr.course_id
   LEFT JOIN courses related ON cr.related_course_id = related.id
   WHERE c.external_course_code = '0076'
   ORDER BY cr.relationship_type, cr.group_id;
   ```

## Re-running the Import

You can safely re-run the import multiple times:
- Existing courses will be updated with new data
- Tags, eligibility, and relationships will be refreshed
- User-curated descriptions in the `courses.description` field will be preserved (not overwritten)

## Troubleshooting

### "SUPABASE_URL is not defined"

Make sure you have a `.env` file with the correct environment variables.

### "Failed to read or parse JSON file"

Check that `data/output/step6_admin_upload.json` exists and is valid JSON.

### Import is slow

The import processes each course sequentially to ensure data consistency. For 615 courses, expect the import to take 5-10 minutes depending on network speed.

### Relationship errors

If you see errors creating relationships, it may be because:
- The referenced course doesn't exist in the JSON
- The `course_code` in the prerequisite doesn't match any `course_id`

These are logged but don't stop the import. The relationship will be created with `related_course_id = NULL` and the text description preserved.

## Next Steps

After importing:

1. **Add Descriptions**: Use the Planna admin interface to add curated course descriptions
2. **Create Preset Plans**: Build preset degree plans for common pathways
3. **Add School Data**: When available, extend the import to include school assignments (see `docs/SCHOOLS_FUTURE_IMPLEMENTATION.md`)

## Schema Changes

If you need to modify the schema:

1. Create a new migration in `supabase/migrations/`
2. Apply it via Supabase MCP tools or the Supabase dashboard
3. Update the import script if needed to match the new schema

## Support

For issues or questions about the import process, refer to:
- `scripts/import_courses_from_step6.ts` - The import script source code
- `supabase/migrations/20260211000000_reset_public_schema.sql` - The schema definition
- `docs/SCHOOLS_FUTURE_IMPLEMENTATION.md` - Future school data implementation







