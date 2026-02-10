import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read and parse JSON file
console.log('Reading courses.katy-isd.json...');
const jsonData = JSON.parse(fs.readFileSync('./archaic/courses.katy-isd.json', 'utf8'));
const courses = jsonData.courses;
console.log(`Found ${courses.length} courses to import`);

// Helper function to escape SQL strings and handle nulls
function escapeSql(str) {
  if (str === null || str === undefined || str === 'n/a') return null;
  return String(str).replace(/'/g, "''");
}

// Process courses and generate SQL statements in chunks
const CHUNK_SIZE = 100;
const totalChunks = Math.ceil(courses.length / CHUNK_SIZE);

function generateChunkSql(chunkIndex) {
  const start = chunkIndex * CHUNK_SIZE;
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
    
    const sql = `INSERT INTO courses (course_code, course_name, credits, gpa, subject, term, prerequisite_text, corequisite_text, enrollment_notes, course_description) VALUES ('${code}', '${name}', ${course.credits}, ${course.gpa}, '${subj}', '${term}', ${prereq ? `'${prereq}'` : 'NULL'}, ${coreq ? `'${coreq}'` : 'NULL'}, ${notes ? `'${notes}'` : 'NULL'}, ${desc ? `'${desc}'` : 'NULL'}) ON CONFLICT (course_code) DO NOTHING`;
    sqlStatements.push(sql);
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
  
  return { start, end, sql: sqlStatements };
}

// Export for use
export { courses, generateChunkSql, totalChunks, CHUNK_SIZE };

// If run directly, output stats
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`\nTotal courses: ${courses.length}`);
  console.log(`Chunk size: ${CHUNK_SIZE}`);
  console.log(`Total chunks: ${totalChunks}`);
  
  // Test first chunk
  const test = generateChunkSql(0);
  console.log(`\nFirst chunk: courses ${test.start + 1}-${test.end}`);
  console.log(`Generated ${test.sql.length} SQL statements`);
  console.log('\nFirst 3 statements:');
  test.sql.slice(0, 3).forEach((s, i) => console.log(`${i + 1}. ${s.substring(0, 100)}...`));
}

