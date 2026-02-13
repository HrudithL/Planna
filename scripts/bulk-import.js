import fs from 'fs';

// Read and parse JSON file
console.log('Reading courses.katy-isd.json...');
const jsonData = JSON.parse(fs.readFileSync('./archaic/courses.katy-isd.json', 'utf8'));
const courses = jsonData.courses;
console.log(`Found ${courses.length} courses to import\n`);

// Helper function to escape SQL strings and handle nulls
function escapeSql(str) {
  if (str === null || str === undefined || str === 'n/a') return null;
  return String(str).replace(/'/g, "''");
}

// Generate SQL for a specific range of courses
function generateSqlForRange(startIdx, endIdx) {
  const chunk = courses.slice(startIdx, endIdx);
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
  
  return sqlStatements;
}

// Get command line arguments
const args = process.argv.slice(2);
const chunkIndex = parseInt(args[0] || '0');
const chunkSize = parseInt(args[1] || '100');

const start = chunkIndex * chunkSize;
const end = Math.min(start + chunkSize, courses.length);
const totalChunks = Math.ceil(courses.length / chunkSize);

console.log(`Generating SQL for chunk ${chunkIndex + 1}/${totalChunks}`);
console.log(`Courses ${start + 1} to ${end} (${end - start} courses)\n`);

const sql = generateSqlForRange(start, end);
console.log(JSON.stringify(sql, null, 2));









