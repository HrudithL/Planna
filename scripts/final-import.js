#!/usr/bin/env node
/**
 * Final comprehensive import script
 * Generates SQL for ALL courses and outputs them in manageable segments
 */
import fs from 'fs';

const jsonData = JSON.parse(fs.readFileSync('./archaic/courses.katy-isd.json', 'utf8'));
const courses = jsonData.courses;

function escapeSql(str) {
  if (str === null || str === undefined || str === 'n/a') return null;
  return String(str).replace(/'/g, "''");
}

console.log(`Generating SQL for ${courses.length} courses...`);
console.log(`This will create a single comprehensive SQL file.\n`);

const allSql = [];

// Generate ALL SQL statements
courses.forEach((course, idx) => {
  const prereq = escapeSql(course.prerequisite);
  const coreq = escapeSql(course.corequisite);
  const notes = escapeSql(course.enrollmentNotes);
  const desc = escapeSql(course.courseDescription);
  const code = escapeSql(course.courseCode);
  const name = escapeSql(course.courseName);
  const subj = escapeSql(course.subject);
  const term = escapeSql(course.term);
  
  allSql.push(`INSERT INTO courses (course_code, course_name, credits, gpa, subject, term, prerequisite_text, corequisite_text, enrollment_notes, course_description) VALUES ('${code}', '${name}', ${course.credits}, ${course.gpa}, '${subj}', '${term}', ${prereq ? `'${prereq}'` : 'NULL'}, ${coreq ? `'${coreq}'` : 'NULL'}, ${notes ? `'${notes}'` : 'NULL'}, ${desc ? `'${desc}'` : 'NULL'}) ON CONFLICT (course_code) DO NOTHING;`);
  
  if (course.tags && course.tags.length > 0) {
    course.tags.forEach(tag => {
      const tagEsc = escapeSql(tag);
      allSql.push(`INSERT INTO course_tags (course_id, tag) SELECT id, '${tagEsc}' FROM courses WHERE course_code = '${code}' ON CONFLICT (course_id, tag) DO NOTHING;`);
    });
  }
  
  if (course.eligibleGrades && course.eligibleGrades.length > 0) {
    course.eligibleGrades.forEach(grade => {
      const gradeEsc = escapeSql(grade);
      allSql.push(`INSERT INTO course_eligible_grades (course_id, grade) SELECT id, '${gradeEsc}' FROM courses WHERE course_code = '${code}' ON CONFLICT (course_id, grade) DO NOTHING;`);
    });
  }
});

console.log(`Generated ${allSql.length} SQL statements`);

// Write as a single SQL file
const sqlContent = allSql.join('\n');
fs.writeFileSync('./scripts/import-all.sql', sqlContent);

console.log(`\nWrote SQL to ./scripts/import-all.sql`);
console.log(`\nYou can now execute this SQL file against the Neon database.`);
console.log(`File size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);









