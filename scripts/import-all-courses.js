#!/usr/bin/env node
import fs from 'fs';

// Read and parse JSON file
const jsonData = JSON.parse(fs.readFileSync('./archaic/courses.katy-isd.json', 'utf8'));
const courses = jsonData.courses;

// Helper function to escape SQL strings and handle nulls
function escapeSql(str) {
  if (str === null || str === undefined || str === 'n/a') return null;
  return String(str).replace(/'/g, "''");
}

// Generate SQL for all courses
const CHUNK_SIZE = 100;
const totalChunks = Math.ceil(courses.length / CHUNK_SIZE);

console.log(`Total courses: ${courses.length}`);
console.log(`Chunk size: ${CHUNK_SIZE}`);
console.log(`Total chunks: ${totalChunks}\n`);

const allChunks = [];

for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
  const start = chunkIdx * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, courses.length);
  const chunk = courses.slice(start, end);
  
  const sqlStatements = [];
  
  // Insert courses
  chunk.forEach(course => {
    const prereq = escapeSql(course.prerequisite);
    const coreq = escapeSql(course.corequisite);
    const notes = escapeSql(course.enrollmentNotes);
    const desc = escapeSql(course.courseDescription);
    const code = escapeSql(course.courseCode);
    const name = escapeSql(course.courseName);
    const subj = escapeSql(course.subject);
    const term = escapeSql(course.term);
    
    sqlStatements.push(`INSERT INTO courses (course_code, course_name, credits, gpa, subject, term, prerequisite_text, corequisite_text, enrollment_notes, course_description) VALUES ('${code}', '${name}', ${course.credits}, ${course.gpa}, '${subj}', '${term}', ${prereq ? `'${prereq}'` : 'NULL'}, ${coreq ? `'${coreq}'` : 'NULL'}, ${notes ? `'${notes}'` : 'NULL'}, ${desc ? `'${desc}'` : 'NULL'}) ON CONFLICT (course_code) DO NOTHING`);
  });
  
  // Insert tags and grades
  chunk.forEach(course => {
    const code = escapeSql(course.courseCode);
    
    if (course.tags && course.tags.length > 0) {
      course.tags.forEach(tag => {
        const tagEsc = escapeSql(tag);
        sqlStatements.push(`INSERT INTO course_tags (course_id, tag) SELECT id, '${tagEsc}' FROM courses WHERE course_code = '${code}' ON CONFLICT (course_id, tag) DO NOTHING`);
      });
    }
    
    if (course.eligibleGrades && course.eligibleGrades.length > 0) {
      course.eligibleGrades.forEach(grade => {
        const gradeEsc = escapeSql(grade);
        sqlStatements.push(`INSERT INTO course_eligible_grades (course_id, grade) SELECT id, '${gradeEsc}' FROM courses WHERE course_code = '${code}' ON CONFLICT (course_id, grade) DO NOTHING`);
      });
    }
  });
  
  allChunks.push({
    chunkIndex: chunkIdx,
    startCourse: start + 1,
    endCourse: end,
    count: end - start,
    sqlCount: sqlStatements.length,
    sql: sqlStatements
  });
}

// Write all chunks to individual files
allChunks.forEach(chunk => {
  const filename = `./scripts/sql-chunks/chunk-${chunk.chunkIndex.toString().padStart(3, '0')}.json`;
  fs.mkdirSync('./scripts/sql-chunks', { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(chunk, null, 2));
});

console.log(`Generated ${allChunks.length} chunk files in ./scripts/sql-chunks/`);
console.log(`\nTo import, use the Neon MCP run_sql_transaction tool with each chunk's SQL array.`);









