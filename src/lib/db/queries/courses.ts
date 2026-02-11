import { supabase, isSupabaseAvailable } from '../../supabaseClient';
import type { Course } from '@/types';

// Helper function to fetch tags and grades for courses
async function enrichCoursesWithRelations(courses: any[]): Promise<Course[]> {
  if (courses.length === 0) return [];
  
  const courseIds = courses.map(c => c.id);
  
  // Fetch tags
  const { data: tagsData } = await supabase
    .from('course_tags')
    .select('course_id, tag')
    .in('course_id', courseIds);
  
  // Fetch eligible grades
  const { data: gradesData } = await supabase
    .from('course_eligible_grades')
    .select('course_id, grade')
    .in('course_id', courseIds);
  
  // Group tags and grades by course_id
  const tagsByCourse: Record<string, string[]> = {};
  const gradesByCourse: Record<string, string[]> = {};
  
  (tagsData || []).forEach(t => {
    if (!tagsByCourse[t.course_id]) tagsByCourse[t.course_id] = [];
    tagsByCourse[t.course_id].push(t.tag);
  });
  
  (gradesData || []).forEach(g => {
    if (!gradesByCourse[g.course_id]) gradesByCourse[g.course_id] = [];
    gradesByCourse[g.course_id].push(g.grade);
  });
  
  return courses.map(row => ({
    id: row.id,
    course_code: row.course_code,
    course_name: row.course_name,
    credits: typeof row.credits === 'string' ? parseFloat(row.credits) : row.credits,
    gpa: typeof row.gpa === 'string' ? parseFloat(row.gpa) : row.gpa,
    subject: row.subject,
    term: row.term,
    prerequisite_text: row.prerequisite_text,
    corequisite_text: row.corequisite_text,
    enrollment_notes: row.enrollment_notes,
    course_description: row.course_description,
    tags: tagsByCourse[row.id] || [],
    eligible_grades: gradesByCourse[row.id] || [],
  }));
}

export async function getAllCourses(): Promise<Course[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('course_code');
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  return enrichCoursesWithRelations(data);
}

export async function getCourseById(id: string): Promise<Course | null> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) return null;
  
  const enriched = await enrichCoursesWithRelations([data]);
  return enriched[0] || null;
}

export async function searchCourses(query: string): Promise<Course[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const searchTerm = query.toLowerCase();
  
  // Supabase doesn't support OR across multiple columns directly in the query builder,
  // so we'll use the `or` filter syntax
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .or(`course_code.ilike.%${searchTerm}%,course_name.ilike.%${searchTerm}%,course_description.ilike.%${searchTerm}%`)
    .order('course_code')
    .limit(100);
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  return enrichCoursesWithRelations(data);
}

export async function getSubjects(): Promise<string[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('courses')
    .select('subject')
    .order('subject');
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  // Remove duplicates
  return [...new Set(data.map(row => row.subject))];
}

export async function getTags(): Promise<string[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('course_tags')
    .select('tag')
    .order('tag');
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  // Remove duplicates
  return [...new Set(data.map(row => row.tag))];
}



