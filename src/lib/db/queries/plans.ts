import { supabase, isSupabaseAvailable } from '../../supabaseClient';
import type { DegreePlan, PlanCourse } from '@/types';

export async function getUserPlans(userId: string): Promise<DegreePlan[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('degree_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_preset', false)
    .order('updated_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  return data.map(row => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    is_preset: row.is_preset,
    preset_category: row.preset_category,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getPlanById(id: string): Promise<(DegreePlan & { courses: PlanCourse[] }) | null> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  // Get the plan
  const { data: plan, error: planError } = await supabase
    .from('degree_plans')
    .select('*')
    .eq('id', id)
    .single();
  
  if (planError || !plan) return null;
  
  // Get plan courses with basic course info
  const { data: planCourses, error: coursesError } = await supabase
    .from('plan_courses')
    .select(`
      *,
      courses (
        id, course_code, course_name, credits, gpa, subject, term,
        prerequisite_text, corequisite_text, enrollment_notes, course_description
      )
    `)
    .eq('degree_plan_id', id)
    .order('year')
    .order('order_index');
  
  if (coursesError) throw new Error(coursesError.message);
  
  // If there are courses, fetch their tags and grades
  let courses: PlanCourse[] = [];
  if (planCourses && planCourses.length > 0) {
    const courseIds = planCourses.map(pc => pc.course_id);
    
    // Fetch tags
    const { data: tagsData } = await supabase
      .from('course_tags')
      .select('course_id, tag')
      .in('course_id', courseIds);
    
    // Fetch grades
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
    
    // Assemble the courses with all their data
    courses = planCourses.map(pc => {
      const courseData = pc.courses as any;
      return {
        id: pc.id,
        degree_plan_id: pc.degree_plan_id,
        course_id: pc.course_id,
        semester: pc.semester,
        year: pc.year,
        grade_level: pc.grade_level,
        order_index: pc.order_index,
        notes: pc.notes,
        course: {
          id: courseData.id,
          course_code: courseData.course_code,
          course_name: courseData.course_name,
          credits: typeof courseData.credits === 'string' ? parseFloat(courseData.credits) : courseData.credits,
          gpa: typeof courseData.gpa === 'string' ? parseFloat(courseData.gpa) : courseData.gpa,
          subject: courseData.subject,
          term: courseData.term,
          prerequisite_text: courseData.prerequisite_text,
          corequisite_text: courseData.corequisite_text,
          enrollment_notes: courseData.enrollment_notes,
          course_description: courseData.course_description,
          tags: tagsByCourse[courseData.id] || [],
          eligible_grades: gradesByCourse[courseData.id] || [],
        },
      };
    });
  }
  
  return {
    id: plan.id,
    user_id: plan.user_id,
    name: plan.name,
    description: plan.description,
    is_preset: plan.is_preset,
    preset_category: plan.preset_category,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    courses,
  };
}

export async function createPlan(userId: string, name: string, description: string | null): Promise<DegreePlan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('degree_plans')
    .insert({ user_id: userId, name, description, is_preset: false })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create plan');
  }
  
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description,
    is_preset: data.is_preset,
    preset_category: data.preset_category,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updatePlan(id: string, updates: Partial<DegreePlan>): Promise<DegreePlan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  updateData.updated_at = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('degree_plans')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update plan');
  }
  
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description,
    is_preset: data.is_preset,
    preset_category: data.preset_category,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deletePlan(id: string): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { error } = await supabase
    .from('degree_plans')
    .delete()
    .eq('id', id);
  
  if (error) throw new Error(error.message);
}

export async function addCourseToPlan(
  planId: string,
  courseId: string,
  semester: string,
  year: number,
  gradeLevel: string
): Promise<PlanCourse> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  // Get the max order_index for this plan/semester/year
  const { data: maxOrderData } = await supabase
    .from('plan_courses')
    .select('order_index')
    .eq('degree_plan_id', planId)
    .eq('semester', semester)
    .eq('year', year)
    .order('order_index', { ascending: false })
    .limit(1);
  
  const orderIndex = (maxOrderData && maxOrderData.length > 0 && maxOrderData[0].order_index !== null) 
    ? maxOrderData[0].order_index + 1 
    : 0;
  
  const { data, error } = await supabase
    .from('plan_courses')
    .insert({
      degree_plan_id: planId,
      course_id: courseId,
      semester,
      year,
      grade_level: gradeLevel,
      order_index: orderIndex,
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to add course to plan');
  }
  
  return data;
}

export async function removeCourseFromPlan(planId: string, planCourseId: string): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { error } = await supabase
    .from('plan_courses')
    .delete()
    .eq('id', planCourseId)
    .eq('degree_plan_id', planId);
  
  if (error) throw new Error(error.message);
}

export async function getAllPresets(): Promise<DegreePlan[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('degree_plans')
    .select('*')
    .eq('is_preset', true)
    .order('preset_category')
    .order('name');
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  return data.map(row => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    is_preset: row.is_preset,
    preset_category: row.preset_category,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function clonePreset(presetId: string, userId: string): Promise<DegreePlan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  // Get the preset with its courses
  const preset = await getPlanById(presetId);
  if (!preset) throw new Error('Preset not found');
  
  // Create new plan
  const newPlan = await createPlan(userId, `${preset.name} (Copy)`, preset.description);
  
  // Copy all courses if there are any
  if (preset.courses && preset.courses.length > 0) {
    const coursesToInsert = preset.courses.map(pc => ({
      degree_plan_id: newPlan.id,
      course_id: pc.course_id,
      semester: pc.semester,
      year: pc.year,
      grade_level: pc.grade_level,
      order_index: pc.order_index,
      notes: pc.notes,
    }));
    
    const { error } = await supabase
      .from('plan_courses')
      .insert(coursesToInsert);
    
    if (error) throw new Error(error.message);
  }
  
  return newPlan;
}
