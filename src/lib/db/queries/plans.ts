import { supabase, isSupabaseAvailable } from '../../supabaseClient';
import type { Plan, PlanCourse } from '@/types';

export async function getUserPlans(userId: string): Promise<Plan[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('owner_user_id', userId)
    .eq('is_preset', false)
    .order('updated_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  return data.map(row => ({
    id: row.id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    description: row.description,
    is_preset: row.is_preset,
    base_preset_id: row.base_preset_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getPlanById(id: string): Promise<(Plan & { courses: PlanCourse[] }) | null> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  // Get the plan
  const { data: plan, error: planError } = await supabase
    .from('plans')
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
        id, external_course_code, name, credits, length, gpa_weight, subject,
        is_elective, description, notes, is_offered
      )
    `)
    .eq('plan_id', id)
    .order('year_index')
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
    
    // Fetch grades (from course_eligibility table)
    const { data: gradesData } = await supabase
      .from('course_eligibility')
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
      if (!gradesByCourse[g.course_id].includes(g.grade)) {
        gradesByCourse[g.course_id].push(g.grade);
      }
    });
    
    // Assemble the courses with all their data
    courses = planCourses.map(pc => {
      const courseData = pc.courses as any;
      return {
        id: pc.id,
        plan_id: pc.plan_id,
        course_id: pc.course_id,
        variant_id: pc.variant_id ?? null,
        year_index: pc.year_index,
        term_index: pc.term_index,
        grade_level: pc.grade_level,
        order_index: pc.order_index,
        is_from_preset: pc.is_from_preset ?? false,
        locked: pc.locked ?? false,
        notes: pc.notes,
        course: courseData ? {
          id: courseData.id,
          external_course_code: courseData.external_course_code,
          name: courseData.name,
          credits: typeof courseData.credits === 'string' ? parseFloat(courseData.credits) : courseData.credits,
          length: courseData.length ?? 1,
          gpa_weight: typeof courseData.gpa_weight === 'string' ? parseFloat(courseData.gpa_weight) : courseData.gpa_weight,
          subject: courseData.subject,
          is_elective: courseData.is_elective ?? false,
          description: courseData.description,
          notes: courseData.notes,
          is_offered: courseData.is_offered ?? true,
          tags: tagsByCourse[courseData.id] || [],
          eligible_grades: gradesByCourse[courseData.id] || [],
          variants: [],
        } : undefined,
      };
    });
  }
  
  return {
    id: plan.id,
    owner_user_id: plan.owner_user_id,
    name: plan.name,
    description: plan.description,
    is_preset: plan.is_preset,
    base_preset_id: plan.base_preset_id,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    courses,
  };
}

export async function createPlan(userId: string, name: string, description: string | null): Promise<Plan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('plans')
    .insert({ owner_user_id: userId, name, description, is_preset: false })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create plan');
  }
  
  return {
    id: data.id,
    owner_user_id: data.owner_user_id,
    name: data.name,
    description: data.description,
    is_preset: data.is_preset,
    base_preset_id: data.base_preset_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updatePlan(id: string, updates: Partial<Plan>): Promise<Plan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  updateData.updated_at = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('plans')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update plan');
  }
  
  return {
    id: data.id,
    owner_user_id: data.owner_user_id,
    name: data.name,
    description: data.description,
    is_preset: data.is_preset,
    base_preset_id: data.base_preset_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deletePlan(id: string): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id);
  
  if (error) throw new Error(error.message);
}

export async function addCourseToPlan(
  planId: string,
  courseId: string,
  termIndex: number,
  yearIndex: number,
  gradeLevel: string
): Promise<PlanCourse> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  // Get the max order_index for this plan/term/year
  const { data: maxOrderData } = await supabase
    .from('plan_courses')
    .select('order_index')
    .eq('plan_id', planId)
    .eq('term_index', termIndex)
    .eq('year_index', yearIndex)
    .order('order_index', { ascending: false })
    .limit(1);
  
  const orderIndex = (maxOrderData && maxOrderData.length > 0 && maxOrderData[0].order_index !== null) 
    ? maxOrderData[0].order_index + 1 
    : 0;
  
  const { data, error } = await supabase
    .from('plan_courses')
    .insert({
      plan_id: planId,
      course_id: courseId,
      term_index: termIndex,
      year_index: yearIndex,
      grade_level: gradeLevel,
      order_index: orderIndex,
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(error?.message || 'Failed to add course to plan');
  }
  
  return {
    id: data.id,
    plan_id: data.plan_id,
    course_id: data.course_id,
    variant_id: data.variant_id ?? null,
    year_index: data.year_index,
    term_index: data.term_index,
    grade_level: data.grade_level,
    order_index: data.order_index,
    is_from_preset: data.is_from_preset ?? false,
    locked: data.locked ?? false,
    notes: data.notes,
  };
}

export async function removeCourseFromPlan(planId: string, planCourseId: string): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { error } = await supabase
    .from('plan_courses')
    .delete()
    .eq('id', planCourseId)
    .eq('plan_id', planId);
  
  if (error) throw new Error(error.message);
}

export async function getAllPresets(): Promise<Plan[]> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_preset', true)
    .order('name');
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  return data.map(row => ({
    id: row.id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    description: row.description,
    is_preset: row.is_preset,
    base_preset_id: row.base_preset_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function clonePreset(presetId: string, userId: string): Promise<Plan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');
  
  // Get the preset with its courses
  const preset = await getPlanById(presetId);
  if (!preset) throw new Error('Preset not found');
  
  // Create new plan linked to the preset
  const { data: newPlanData, error: createError } = await supabase
    .from('plans')
    .insert({
      owner_user_id: userId,
      name: `${preset.name} (Copy)`,
      description: preset.description,
      is_preset: false,
      base_preset_id: presetId,
    })
    .select()
    .single();

  if (createError || !newPlanData) {
    throw new Error(createError?.message || 'Failed to create plan from preset');
  }

  const newPlan: Plan = {
    id: newPlanData.id,
    owner_user_id: newPlanData.owner_user_id,
    name: newPlanData.name,
    description: newPlanData.description,
    is_preset: newPlanData.is_preset,
    base_preset_id: newPlanData.base_preset_id,
    created_at: newPlanData.created_at,
    updated_at: newPlanData.updated_at,
  };
  
  // Copy all courses if there are any
  if (preset.courses && preset.courses.length > 0) {
    const coursesToInsert = preset.courses.map(pc => ({
      plan_id: newPlan.id,
      course_id: pc.course_id,
      term_index: pc.term_index,
      year_index: pc.year_index,
      grade_level: pc.grade_level,
      order_index: pc.order_index,
      is_from_preset: true,
      notes: pc.notes,
    }));
    
    const { error } = await supabase
      .from('plan_courses')
      .insert(coursesToInsert);
    
    if (error) throw new Error(error.message);
  }
  
  return newPlan;
}

// ── Preset CRUD ──

export async function createPreset(name: string, description: string | null): Promise<Plan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const { data, error } = await supabase
    .from('plans')
    .insert({
      owner_user_id: null,
      name,
      description,
      is_preset: true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create preset');
  }

  return {
    id: data.id,
    owner_user_id: data.owner_user_id,
    name: data.name,
    description: data.description,
    is_preset: data.is_preset,
    base_preset_id: data.base_preset_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updatePreset(id: string, updates: Partial<Plan>): Promise<Plan> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('plans')
    .update(updateData)
    .eq('id', id)
    .eq('is_preset', true)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update preset');
  }

  return {
    id: data.id,
    owner_user_id: data.owner_user_id,
    name: data.name,
    description: data.description,
    is_preset: data.is_preset,
    base_preset_id: data.base_preset_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deletePreset(id: string): Promise<void> {
  if (!isSupabaseAvailable()) throw new Error('Database not available');

  // plan_courses cascade on plan delete via FK
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id)
    .eq('is_preset', true);

  if (error) throw new Error(error.message);
}