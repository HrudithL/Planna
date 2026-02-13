import { supabase, isSupabaseAvailable } from '../../supabaseClient';

export interface AdminStats {
  courses: number;
  users: number;
  plans: number;
  presets: number;
}

export interface CourseIssue {
  course_id: string;
  external_course_code: string;
  course_name: string;
  issue_type: 'unresolved_prerequisite' | 'unresolved_corequisite';
  relationship_id: string;
  description: string | null;
}

/**
 * Get accurate admin dashboard statistics from the database.
 */
export async function getAdminStats(): Promise<AdminStats> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  // Count offered courses
  const { count: courseCount, error: courseErr } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true })
    .eq('is_offered', true);

  if (courseErr) throw new Error(courseErr.message);

  // Count distinct users (owner_user_id in non-preset plans)
  const { data: userRows, error: userErr } = await supabase
    .from('plans')
    .select('owner_user_id')
    .eq('is_preset', false)
    .not('owner_user_id', 'is', null);

  if (userErr) throw new Error(userErr.message);

  const distinctUsers = new Set((userRows || []).map(r => r.owner_user_id)).size;

  // Count student plans (non-preset)
  const { count: planCount, error: planErr } = await supabase
    .from('plans')
    .select('*', { count: 'exact', head: true })
    .eq('is_preset', false);

  if (planErr) throw new Error(planErr.message);

  // Count presets
  const { count: presetCount, error: presetErr } = await supabase
    .from('plans')
    .select('*', { count: 'exact', head: true })
    .eq('is_preset', true);

  if (presetErr) throw new Error(presetErr.message);

  return {
    courses: courseCount ?? 0,
    users: distinctUsers,
    plans: planCount ?? 0,
    presets: presetCount ?? 0,
  };
}

/**
 * Get courses that have unresolved prerequisite/corequisite relationships
 * (related_course_id IS NULL).
 */
export async function getCoursesWithIssues(): Promise<CourseIssue[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('course_relationships')
    .select(`
      id,
      course_id,
      relationship_type,
      description,
      courses!course_relationships_course_id_fkey (
        external_course_code,
        name
      )
    `)
    .is('related_course_id', null);

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    course_id: row.course_id,
    external_course_code: row.courses?.external_course_code ?? '',
    course_name: row.courses?.name ?? '',
    issue_type: row.relationship_type === 'prerequisite' ? 'unresolved_prerequisite' : 'unresolved_corequisite',
    relationship_id: row.id,
    description: row.description,
  }));
}

/**
 * Get the set of course IDs that have at least one unresolved relationship.
 */
export async function getCourseIdsWithIssues(): Promise<Set<string>> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('course_relationships')
    .select('course_id')
    .is('related_course_id', null);

  if (error) throw new Error(error.message);
  return new Set((data || []).map(r => r.course_id));
}

/**
 * Fix a single unresolved relationship by updating related_course_id.
 */
export async function fixCourseRelationship(relationshipId: string, relatedCourseId: string): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { error } = await supabase
    .from('course_relationships')
    .update({ related_course_id: relatedCourseId })
    .eq('id', relationshipId);

  if (error) throw new Error(error.message);
}

/**
 * Add a new course relationship (prerequisite, corequisite, or recommended).
 */
export async function addCourseRelationship(
  courseId: string,
  relatedCourseId: string,
  relationshipType: 'prerequisite' | 'corequisite' | 'recommended',
  description?: string,
  logicType?: 'AND' | 'OR',
  groupId?: string,
): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { error } = await supabase
    .from('course_relationships')
    .insert({
      course_id: courseId,
      related_course_id: relatedCourseId,
      relationship_type: relationshipType,
      description: description || null,
      logic_type: logicType || null,
      group_id: groupId || null,
    });

  if (error) throw new Error(error.message);
}

/**
 * Delete a course relationship (e.g., remove an invalid prerequisite entirely).
 */
export async function deleteCourseRelationship(relationshipId: string): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { error } = await supabase
    .from('course_relationships')
    .delete()
    .eq('id', relationshipId);

  if (error) throw new Error(error.message);
}

/**
 * Get all relationships for a specific course.
 */
export async function getCourseRelationships(courseId: string): Promise<any[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('course_relationships')
    .select(`
      id,
      course_id,
      related_course_id,
      related_course_code,
      relationship_type,
      group_id,
      logic_type,
      description,
      related_course:courses!course_relationships_related_course_id_fkey (
        id,
        external_course_code,
        name
      )
    `)
    .eq('course_id', courseId);

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Update a relationship's course code (and optionally resolve the related_course_id).
 * Uses prefix matching: the code "0075" will match the first course whose code starts with "0075".
 */
export async function updateRelationshipCourseCode(
  relationshipId: string,
  courseCode: string,
): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  // Try to resolve the code to an actual course (exact match first, then prefix)
  let resolvedId: string | null = null;

  // Exact match
  const { data: exact } = await supabase
    .from('courses')
    .select('id')
    .eq('external_course_code', courseCode)
    .limit(1);

  if (exact && exact.length > 0) {
    resolvedId = exact[0].id;
  } else {
    // Prefix match: find any course whose code starts with the given code
    const { data: prefix } = await supabase
      .from('courses')
      .select('id')
      .like('external_course_code', `${courseCode}%`)
      .limit(1);

    if (prefix && prefix.length > 0) {
      resolvedId = prefix[0].id;
    }
  }

  const { error } = await supabase
    .from('course_relationships')
    .update({
      related_course_code: courseCode || null,
      related_course_id: resolvedId,
    })
    .eq('id', relationshipId);

  if (error) throw new Error(error.message);
}

/**
 * Add a new course relationship by course code (not by course UUID).
 * Uses prefix matching to resolve the code to a course.
 */
export async function addCourseRelationshipByCode(
  courseId: string,
  relatedCourseCode: string,
  relationshipType: 'prerequisite' | 'corequisite' | 'recommended',
  description?: string,
  logicType?: 'AND' | 'OR',
  groupId?: string,
): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  // Resolve course code to id (exact then prefix)
  let resolvedId: string | null = null;

  const { data: exact } = await supabase
    .from('courses')
    .select('id')
    .eq('external_course_code', relatedCourseCode)
    .limit(1);

  if (exact && exact.length > 0) {
    resolvedId = exact[0].id;
  } else if (relatedCourseCode) {
    const { data: prefix } = await supabase
      .from('courses')
      .select('id')
      .like('external_course_code', `${relatedCourseCode}%`)
      .limit(1);

    if (prefix && prefix.length > 0) {
      resolvedId = prefix[0].id;
    }
  }

  const { error } = await supabase
    .from('course_relationships')
    .insert({
      course_id: courseId,
      related_course_id: resolvedId,
      related_course_code: relatedCourseCode || null,
      relationship_type: relationshipType,
      description: description || null,
      logic_type: logicType || null,
      group_id: groupId || null,
    });

  if (error) throw new Error(error.message);
}

