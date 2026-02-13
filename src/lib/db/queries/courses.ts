import { supabase, isSupabaseAvailable } from '../../supabaseClient';
import type { Course, CourseVariant } from '@/types';

/**
 * Helper to map a raw row from the RPC (or enriched query) into a Course object.
 */
function mapRowToCourse(row: any): Course {
  return {
    id: row.id,
    external_course_code: row.external_course_code,
    name: row.name,
    credits: typeof row.credits === 'string' ? parseFloat(row.credits) : (row.credits ?? 0),
    length: row.length ?? 1,
    gpa_weight: typeof row.gpa_weight === 'string' ? parseFloat(row.gpa_weight) : (row.gpa_weight ?? 4),
    subject: row.subject ?? '',
    is_elective: row.is_elective ?? false,
    description: row.description ?? null,
    notes: row.notes ?? null,
    is_offered: row.is_offered ?? true,
    term: row.term ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    eligible_grades: Array.isArray(row.eligible_grades) ? row.eligible_grades : [],
    variants: [], // course_variants table was removed; kept for type compatibility
  };
}

/**
 * Fetch ALL courses with tags and eligible_grades pre-joined in a single RPC call.
 * This replaces the old N+1 enrichment approach (was 15+ HTTP round-trips, now 1).
 */
export async function getAllCoursesEnriched(): Promise<Course[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase.rpc('get_courses_enriched');

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map(mapRowToCourse);
}

/**
 * Legacy: Fetch all courses (uses RPC now).
 */
export async function getAllCourses(): Promise<Course[]> {
  return getAllCoursesEnriched();
}

export async function getCourseById(id: string): Promise<Course | null> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  // Fetch the base course
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  // Fetch tags
  const { data: tagsData } = await supabase
    .from('course_tags')
    .select('tag')
    .eq('course_id', id);

  // Fetch eligible grades
  const { data: gradesData } = await supabase
    .from('course_eligibility')
    .select('grade')
    .eq('course_id', id);

  return {
    ...mapRowToCourse(data),
    tags: (tagsData || []).map(t => t.tag),
    eligible_grades: [...new Set((gradesData || []).map(g => g.grade))],
  };
}

export async function getSubjects(): Promise<string[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('courses')
    .select('subject')
    .eq('is_offered', true)
    .order('subject');

  if (error) throw new Error(error.message);
  if (!data) return [];

  return [...new Set(data.map(row => row.subject).filter(Boolean))];
}

export async function getTags(): Promise<string[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('course_tags')
    .select('tag')
    .order('tag');

  if (error) throw new Error(error.message);
  if (!data) return [];

  return [...new Set(data.map(row => row.tag))];
}

/**
 * Update a course's base fields, tags, and eligibility.
 */
export async function updateCourse(
  id: string,
  updates: Partial<Course> & { tags?: string[]; eligible_grades?: string[] }
): Promise<Course> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  // Update base course fields
  const baseFields: Record<string, any> = {};
  if (updates.name !== undefined) baseFields.name = updates.name;
  if (updates.credits !== undefined) baseFields.credits = updates.credits;
  if (updates.length !== undefined) baseFields.length = updates.length;
  if (updates.gpa_weight !== undefined) baseFields.gpa_weight = updates.gpa_weight;
  if (updates.subject !== undefined) baseFields.subject = updates.subject;
  if (updates.is_elective !== undefined) baseFields.is_elective = updates.is_elective;
  if (updates.description !== undefined) baseFields.description = updates.description;
  if (updates.notes !== undefined) baseFields.notes = updates.notes;
  if (updates.is_offered !== undefined) baseFields.is_offered = updates.is_offered;

  if (Object.keys(baseFields).length > 0) {
    const { error } = await supabase
      .from('courses')
      .update(baseFields)
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  // Sync tags if provided
  if (updates.tags !== undefined) {
    const { error: delTagErr } = await supabase
      .from('course_tags')
      .delete()
      .eq('course_id', id);
    if (delTagErr) throw new Error(delTagErr.message);

    if (updates.tags.length > 0) {
      const tagRows = updates.tags.map(tag => ({ course_id: id, tag }));
      const { error: insTagErr } = await supabase
        .from('course_tags')
        .insert(tagRows);
      if (insTagErr) throw new Error(insTagErr.message);
    }
  }

  // Sync eligible grades if provided
  if (updates.eligible_grades !== undefined) {
    const { error: delEligErr } = await supabase
      .from('course_eligibility')
      .delete()
      .eq('course_id', id);
    if (delEligErr) throw new Error(delEligErr.message);

    if (updates.eligible_grades.length > 0) {
      const eligRows = updates.eligible_grades.map(grade => ({
        course_id: id,
        grade,
        term_number: null,
        term_name: null,
        can_plan: true,
      }));
      const { error: insEligErr } = await supabase
        .from('course_eligibility')
        .insert(eligRows);
      if (insEligErr) throw new Error(insEligErr.message);
    }
  }

  // Return the updated course
  const course = await getCourseById(id);
  if (!course) throw new Error('Course not found after update');
  return course;
}

/**
 * Create a new course with all related data.
 */
export async function createCourse(
  courseData: {
    external_course_code: string;
    name: string;
    credits: number;
    length: number;
    gpa_weight: number;
    subject: string;
    is_elective: boolean;
    description?: string | null;
    notes?: string | null;
    tags?: string[];
    eligible_grades?: string[];
    variants?: Omit<CourseVariant, 'id' | 'course_id'>[];
  }
): Promise<Course> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { tags, eligible_grades, variants: _variants, ...base } = courseData;

  // Insert course
  const { data: inserted, error: insertErr } = await supabase
    .from('courses')
    .insert({
      ...base,
      is_offered: true,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create course');
  const courseId = inserted.id;

  // Insert tags
  if (tags && tags.length > 0) {
    const tagRows = tags.map(tag => ({ course_id: courseId, tag }));
    await supabase.from('course_tags').insert(tagRows);
  }

  // Insert eligibility
  if (eligible_grades && eligible_grades.length > 0) {
    const eligRows = eligible_grades.map(grade => ({
      course_id: courseId,
      grade,
      term_number: null,
      term_name: null,
      can_plan: true,
    }));
    await supabase.from('course_eligibility').insert(eligRows);
  }

  const course = await getCourseById(courseId);
  if (!course) throw new Error('Course not found after creation');
  return course;
}

// ── Variant stubs (table was removed, kept for API compatibility) ──

export async function getVariantsForCourse(_courseId: string): Promise<CourseVariant[]> {
  return [];
}

export async function createVariant(_courseId: string, _variant: Omit<CourseVariant, 'id' | 'course_id'>): Promise<CourseVariant> {
  throw new Error('Course variants table has been removed');
}

export async function updateVariant(_variantId: string, _updates: Partial<CourseVariant>): Promise<CourseVariant> {
  throw new Error('Course variants table has been removed');
}

export async function deleteVariant(_variantId: string): Promise<void> {
  throw new Error('Course variants table has been removed');
}

/**
 * Get term eligibility for a course at a specific grade level.
 * Returns array of term_number values (1=Semester 1/Fall, 2=Semester 2/Spring).
 * If no specific term data, returns [1, 2] (both semesters).
 */
export async function getCourseTermEligibility(
  courseId: string,
  grade: string,
): Promise<number[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('course_eligibility')
    .select('term_number')
    .eq('course_id', courseId)
    .eq('grade', grade);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [1, 2];

  const terms = data
    .map(r => r.term_number)
    .filter((t): t is number => t !== null && t !== undefined);

  return terms.length > 0 ? terms : [1, 2];
}

/**
 * Check if a set of completed course codes satisfies the prerequisites for a given course.
 * Uses prefix matching: prerequisite code "0075" is satisfied by any completed course
 * whose code starts with "0075" (e.g. "0075A", "0075B").
 *
 * Returns { met: boolean, unmet: string[] } where unmet lists the descriptions of
 * prerequisite groups that are NOT satisfied.
 */
export async function checkPrerequisitesMet(
  courseId: string,
  completedCourseCodes: string[],
): Promise<{ met: boolean; unmet: string[] }> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  // Fetch all prerequisite relationships for this course
  const { data, error } = await supabase
    .from('course_relationships')
    .select('id, related_course_id, related_course_code, relationship_type, group_id, logic_type, description')
    .eq('course_id', courseId)
    .eq('relationship_type', 'prerequisite');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return { met: true, unmet: [] };

  // Group by group_id
  const groups: Record<string, { logicType: string; alternatives: typeof data }> = {};
  for (const rel of data) {
    const gid = rel.group_id || rel.id; // fallback to individual id if no group
    if (!groups[gid]) {
      groups[gid] = { logicType: rel.logic_type || 'OR', alternatives: [] };
    }
    groups[gid].alternatives.push(rel);
  }

  const unmet: string[] = [];

  // Helper: check if a single alternative is satisfied
  const isSatisfied = (rel: typeof data[0]): boolean => {
    const code = rel.related_course_code;
    if (!code) {
      return false;
    }
    // Prefix match: any completed course whose code starts with this code
    return completedCourseCodes.some(cc => cc.startsWith(code));
  };

  for (const [, group] of Object.entries(groups)) {
    if (group.logicType === 'AND') {
      const allMet = group.alternatives.every(alt => isSatisfied(alt));
      if (!allMet) {
        const desc = group.alternatives.map(a => a.description || a.related_course_code || '?').join(' AND ');
        unmet.push(desc);
      }
    } else {
      const anyMet = group.alternatives.some(alt => isSatisfied(alt));
      if (!anyMet) {
        const desc = group.alternatives.map(a => a.description || a.related_course_code || '?').join(' or ');
        unmet.push(desc);
      }
    }
  }

  return { met: unmet.length === 0, unmet };
}
