import { sql } from '../index';
import type { DegreePlan, PlanCourse } from '@/types';

export async function getUserPlans(userId: string): Promise<DegreePlan[]> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT *
    FROM degree_plans
    WHERE user_id = ${userId} AND is_preset = FALSE
    ORDER BY updated_at DESC
  `;
  
  return result.map(row => ({
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
  if (!sql) throw new Error('Database not available');
  
  const planResult = await sql`
    SELECT *
    FROM degree_plans
    WHERE id = ${id}
  `;
  
  if (planResult.length === 0) return null;
  
  const coursesResult = await sql`
    SELECT 
      pc.*,
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
    FROM plan_courses pc
    JOIN courses c ON pc.course_id = c.id
    LEFT JOIN course_tags t ON c.id = t.course_id
    LEFT JOIN course_eligible_grades g ON c.id = g.course_id
    WHERE pc.degree_plan_id = ${id}
    GROUP BY pc.id, c.id, c.course_code, c.course_name, c.credits, c.gpa, c.subject, c.term, 
             c.prerequisite_text, c.corequisite_text, c.enrollment_notes, c.course_description
    ORDER BY pc.year, pc.order_index
  `;
  
  const plan = planResult[0];
  const courses = coursesResult.map(row => ({
    id: row.id,
    degree_plan_id: row.degree_plan_id,
    course_id: row.course_id,
    semester: row.semester,
    year: row.year,
    grade_level: row.grade_level,
    order_index: row.order_index,
    notes: row.notes,
    course: {
      id: row.course_id,
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
    },
  }));
  
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
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    INSERT INTO degree_plans (user_id, name, description, is_preset)
    VALUES (${userId}, ${name}, ${description}, FALSE)
    RETURNING *
  `;
  
  const plan = result[0];
  return {
    id: plan.id,
    user_id: plan.user_id,
    name: plan.name,
    description: plan.description,
    is_preset: plan.is_preset,
    preset_category: plan.preset_category,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

export async function updatePlan(id: string, data: Partial<DegreePlan>): Promise<DegreePlan> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    UPDATE degree_plans
    SET 
      name = COALESCE(${data.name}, name),
      description = COALESCE(${data.description}, description),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  
  const plan = result[0];
  return {
    id: plan.id,
    user_id: plan.user_id,
    name: plan.name,
    description: plan.description,
    is_preset: plan.is_preset,
    preset_category: plan.preset_category,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

export async function deletePlan(id: string): Promise<void> {
  if (!sql) throw new Error('Database not available');
  
  await sql`
    DELETE FROM degree_plans
    WHERE id = ${id}
  `;
}

export async function addCourseToPlan(
  planId: string,
  courseId: string,
  semester: string,
  year: number,
  gradeLevel: string
): Promise<PlanCourse> {
  if (!sql) throw new Error('Database not available');
  
  // Get the max order_index for this plan/semester/year
  const maxOrderResult = await sql`
    SELECT COALESCE(MAX(order_index), -1) as max_order
    FROM plan_courses
    WHERE degree_plan_id = ${planId}
      AND semester = ${semester}
      AND year = ${year}
  `;
  
  const orderIndex = maxOrderResult[0].max_order + 1;
  
  const result = await sql`
    INSERT INTO plan_courses (degree_plan_id, course_id, semester, year, grade_level, order_index)
    VALUES (${planId}, ${courseId}, ${semester}, ${year}, ${gradeLevel}, ${orderIndex})
    RETURNING *
  `;
  
  return result[0];
}

export async function removeCourseFromPlan(planId: string, planCourseId: string): Promise<void> {
  if (!sql) throw new Error('Database not available');
  
  await sql`
    DELETE FROM plan_courses
    WHERE id = ${planCourseId} AND degree_plan_id = ${planId}
  `;
}

export async function getAllPresets(): Promise<DegreePlan[]> {
  if (!sql) throw new Error('Database not available');
  
  const result = await sql`
    SELECT *
    FROM degree_plans
    WHERE is_preset = TRUE
    ORDER BY preset_category, name
  `;
  
  return result.map(row => ({
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
  if (!sql) throw new Error('Database not available');
  
  // Get the preset
  const preset = await getPlanById(presetId);
  if (!preset) throw new Error('Preset not found');
  
  // Create new plan
  const newPlan = await createPlan(userId, `${preset.name} (Copy)`, preset.description);
  
  // Copy all courses
  if (preset.courses && preset.courses.length > 0) {
    await sql`
      INSERT INTO plan_courses (degree_plan_id, course_id, semester, year, grade_level, order_index, notes)
      SELECT ${newPlan.id}, course_id, semester, year, grade_level, order_index, notes
      FROM plan_courses
      WHERE degree_plan_id = ${presetId}
    `;
  }
  
  return newPlan;
}



