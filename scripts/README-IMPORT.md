# Course Import Guide

## Current Status
✅ Database schema created successfully
✅ Test import completed (10 courses verified)
✅ All import scripts generated

## What's Ready
- **Total Courses**: 1,353 courses from `archaic/courses.katy-isd.json`
- **SQL Generated**: 6,151 SQL statements in `scripts/import-all.sql`
- **Batches Created**: 13 batches in `scripts/sql-batches/` (500 statements each)

## Import Methods

### Option 1: Complete Import via SQL File
```bash
# Use psql or any PostgreSQL client
psql $DATABASE_URL -f scripts/import-all.sql
```

### Option 2: Batch Import via MCP Tools
Each batch file (`scripts/sql-batches/batch-XX.json`) contains a JSON array of SQL statements.
Use the `mcp_Neon_run_sql_transaction` tool with each batch:

```javascript
// For each batch 00-12
const batch = require('./scripts/sql-batches/batch-00.json');
// Pass batch array to mcp_Neon_run_sql_transaction
```

### Option 3: Automated Script (Recommended for completion)
Create a Node.js script that loops through all batches:

```javascript
import fs from 'fs';
// Pseudo-code for automation
for (let i = 0; i < 13; i++) {
  const batch = JSON.parse(fs.readFileSync(`./scripts/sql-batches/batch-${i.toString().padStart(2, '0')}.json`));
  // Execute via Neon client or MCP tool
  await executeBatch(batch);
}
```

## Verification
After import, verify with:
```sql
SELECT COUNT(*) FROM courses;  -- Should be 1353
SELECT COUNT(*) FROM course_tags;
SELECT COUNT(*) FROM course_eligible_grades;
```

## Project Details
- **Neon Project ID**: floral-dust-03599690
- **Database**: neondb
- **Branch**: main (br-spring-fog-ajq2xrhv)









