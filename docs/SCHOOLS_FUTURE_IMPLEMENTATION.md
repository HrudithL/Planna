# Schools and School Courses - Future Implementation Guide

This document describes how school data will be added to the Planna database and how the import script will be extended once school information becomes available.

## Current State

The database schema includes two tables for school data:

### `schools` table
- `id` (uuid, primary key)
- `name` (text, not null) - Full school name
- `code` (text, unique) - School code/slug for lookups
- `created_at` (timestamptz)

### `school_courses` table
- `id` (uuid, primary key)
- `school_id` (uuid, references schools.id)
- `course_id` (uuid, references courses.id)
- `is_available` (boolean, default true)
- `notes` (text) - Optional notes about availability
- `created_at` (timestamptz)
- Unique constraint on `(school_id, course_id)`

**Status**: Tables exist but are empty. No school data is currently in the JSON import file.

---

## Future Implementation Plan

### Step 1: Obtain School Data

School information needs to be obtained in one of these formats:

#### Option A: Separate School JSON File
Create a JSON file like `data/schools.json`:

```json
[
  {
    "code": "katy-hs",
    "name": "Katy High School",
    "courses": ["0020", "0073", "0075", ...]
  },
  {
    "code": "taylor-hs",
    "name": "Taylor High School",
    "courses": ["0020", "0073", ...]
  }
]
```

#### Option B: Add School Data to Course JSON
Extend each course object in `step6_admin_upload.json` to include:

```json
{
  "course_id": "0020",
  "name": "Study Hall",
  ...
  "offered_at_schools": [
    {
      "school_code": "katy-hs",
      "school_name": "Katy High School"
    },
    {
      "school_code": "taylor-hs",
      "school_name": "Taylor High School"
    }
  ]
}
```

#### Option C: Scrape from Source API
If the source API (SchooLinks) provides school-level data, add a separate scraper that:
1. Fetches all schools in the district
2. For each school, fetches which courses it offers
3. Outputs a mapping file

---

### Step 2: Extend the Import Script

Once school data is available, modify `scripts/import_courses_from_step6.ts`:

#### If using Option A (Separate School JSON):

```typescript
// Add after main course import
async function importSchools() {
  const schoolsPath = join(process.cwd(), 'data', 'schools.json');
  const schoolsData = JSON.parse(readFileSync(schoolsPath, 'utf-8'));

  for (const school of schoolsData) {
    // Upsert school
    const { data: schoolRow, error: schoolError } = await supabase
      .from('schools')
      .upsert({
        code: school.code,
        name: school.name
      }, { onConflict: 'code' })
      .select('id')
      .single();

    if (schoolError) {
      console.error(`Error upserting school ${school.code}:`, schoolError);
      continue;
    }

    // Link courses to school
    for (const courseCode of school.courses) {
      const courseId = courseCodeToId.get(courseCode);
      if (!courseId) continue;

      await supabase
        .from('school_courses')
        .upsert({
          school_id: schoolRow.id,
          course_id: courseId,
          is_available: true
        }, { onConflict: 'school_id,course_id' });
    }
  }
}
```

#### If using Option B (School Data in Course JSON):

```typescript
// Add within the course import loop (Pass 1)
if (Array.isArray(c.offered_at_schools)) {
  for (const schoolInfo of c.offered_at_schools) {
    // Upsert school
    const { data: schoolRow } = await supabase
      .from('schools')
      .upsert({
        code: schoolInfo.school_code,
        name: schoolInfo.school_name
      }, { onConflict: 'code' })
      .select('id')
      .single();

    if (schoolRow) {
      // Link course to school
      await supabase
        .from('school_courses')
        .upsert({
          school_id: schoolRow.id,
          course_id: courseId,
          is_available: true
        }, { onConflict: 'school_id,course_id' });
    }
  }
}
```

---

### Step 3: Update Statistics Tracking

Add to the stats object in the import script:

```typescript
let stats = {
  // ... existing stats
  schoolsCreated: 0,
  schoolsUpdated: 0,
  schoolCoursesLinked: 0
};
```

And update the summary output to include these new metrics.

---

### Step 4: Create School Management UI (Optional)

Once schools are populated, you may want to add admin UI features:

1. **School List Page** (`/admin/schools`)
   - View all schools
   - Add/edit/delete schools
   - View course count per school

2. **Course-School Assignment** (`/admin/courses/:id/schools`)
   - Manage which schools offer a specific course
   - Bulk assignment tools

3. **School Filter in Course Browser**
   - Allow users to filter courses by their school
   - Show "Available at your school" badge

---

### Step 5: RLS Policies for Schools

If you want to restrict course visibility based on user's school:

```sql
-- Add school_id to user profile or auth.users metadata
ALTER TABLE auth.users ADD COLUMN school_id uuid REFERENCES public.schools(id);

-- Update course visibility policy
CREATE POLICY "Users see courses from their school" ON public.courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.school_courses
      WHERE school_courses.course_id = courses.id
      AND school_courses.school_id = auth.jwt() ->> 'school_id'::uuid
    )
  );
```

---

## Migration Path

When you're ready to add school data:

1. ✅ Schema is already in place (no migration needed)
2. Obtain school data in one of the formats above
3. Extend the import script as described
4. Run the import: `npm run import:courses`
5. Verify data in Supabase dashboard
6. (Optional) Add school management UI
7. (Optional) Add school-based filtering/RLS

---

## Questions to Answer Before Implementation

1. **Data Source**: Where will school information come from?
   - Manual entry?
   - Scraped from API?
   - Provided by district?

2. **School Granularity**: What level of detail do you need?
   - Just school name and code?
   - Address, contact info, etc.?
   - Grade levels offered (e.g., 9-12 vs 10-12)?

3. **Course Availability**: How will you know which courses each school offers?
   - Is this in the API data?
   - Manual curation?
   - Assume all schools offer all courses initially?

4. **User School Assignment**: How will users be linked to schools?
   - During signup?
   - Admin assignment?
   - Self-selection from dropdown?

5. **Multi-School Support**: Can a user see courses from multiple schools?
   - If yes, how do they select/switch schools?
   - If no, strict filtering by their assigned school?

---

## Contact

When you're ready to implement school support, revisit this document and choose the implementation path that matches your data source and requirements.







