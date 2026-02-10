import { sql } from '../index';
import type { Course } from '@/types';

export async function getAllCourses(): Promise<Course[]> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT 
      c.id,
      c.course_code,
      c.course_name,
      c.credits,
      c.gpa,
      c.subject,
      c.term,
      c.prerequisite_text,
      c.corequisite_text,
      c.enrollment_notes,
      c.course_description,
      COALESCE(array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL), '{}') as tags,
      COALESCE(array_agg(DISTINCT g.grade) FILTER (WHERE g.grade IS NOT NULL), '{}') as eligible_grades
    FROM courses c
    LEFT JOIN course_tags t ON c.id = t.course_id
    LEFT JOIN course_eligible_grades g ON c.id = g.course_id
    GROUP BY c.id
    ORDER BY c.course_code
  `;
  
  return result.map(row => ({
    id: row.id,
    course_code: row.course_code,
    course_name: row.course_name,
    credits: parseFloat(row.credits),
    gpa: parseFloat(row.gpa),
    subject: row.subject,
    term: row.term,
    prerequisite_text: row.prerequisite_text,
    corequisite_text: row.corequisite_text,
    enrollment_notes: row.enrollment_notes,
    course_description: row.course_description,
    tags: row.tags || [],
    eligible_grades: row.eligible_grades || [],
  }));
}

export async function getCourseById(id: string): Promise<Course | null> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT 
      c.id,
      c.course_code,
      c.course_name,
      c.credits,
      c.gpa,
      c.subject,
      c.term,
      c.prerequisite_text,
      c.corequisite_text,
      c.enrollment_notes,
      c.course_description,
      COALESCE(array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL), '{}') as tags,
      COALESCE(array_agg(DISTINCT g.grade) FILTER (WHERE g.grade IS NOT NULL), '{}') as eligible_grades
    FROM courses c
    LEFT JOIN course_tags t ON c.id = t.course_id
    LEFT JOIN course_eligible_grades g ON c.id = g.course_id
    WHERE c.id = ${id}
    GROUP BY c.id
  `;
  
  if (result.length === 0) return null;
  
  const row = result[0];
  return {
    id: row.id,
    course_code: row.course_code,
    course_name: row.course_name,
    credits: parseFloat(row.credits),
    gpa: parseFloat(row.gpa),
    subject: row.subject,
    term: row.term,
    prerequisite_text: row.prerequisite_text,
    corequisite_text: row.corequisite_text,
    enrollment_notes: row.enrollment_notes,
    course_description: row.course_description,
    tags: row.tags || [],
    eligible_grades: row.eligible_grades || [],
  };
}

export async function searchCourses(query: string): Promise<Course[]> {
  if (!sql) throw new Error('Database not available');
  
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const result = await sql`
    SELECT 
      c.id,
      c.course_code,
      c.course_name,
      c.credits,
      c.gpa,
      c.subject,
      c.term,
      c.prerequisite_text,
      c.corequisite_text,
      c.enrollment_notes,
      c.course_description,
      COALESCE(array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL), '{}') as tags,
      COALESCE(array_agg(DISTINCT g.grade) FILTER (WHERE g.grade IS NOT NULL), '{}') as eligible_grades
    FROM courses c
    LEFT JOIN course_tags t ON c.id = t.course_id
    LEFT JOIN course_eligible_grades g ON c.id = g.course_id
    WHERE 
      LOWER(c.course_code) LIKE ${searchTerm}
      OR LOWER(c.course_name) LIKE ${searchTerm}
      OR LOWER(c.course_description) LIKE ${searchTerm}
    GROUP BY c.id
    ORDER BY c.course_code
    LIMIT 100
  `;
  
  return result.map(row => ({
    id: row.id,
    course_code: row.course_code,
    course_name: row.course_name,
    credits: parseFloat(row.credits),
    gpa: parseFloat(row.gpa),
    subject: row.subject,
    term: row.term,
    prerequisite_text: row.prerequisite_text,
    corequisite_text: row.corequisite_text,
    enrollment_notes: row.enrollment_notes,
    course_description: row.course_description,
    tags: row.tags || [],
    eligible_grades: row.eligible_grades || [],
  }));
}

export async function getSubjects(): Promise<string[]> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT DISTINCT subject
    FROM courses
    ORDER BY subject
  `;
  
  return result.map(row => row.subject);
}

export async function getTags(): Promise<string[]> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT DISTINCT tag
    FROM course_tags
    ORDER BY tag
  `;
  
  return result.map(row => row.tag);
}



