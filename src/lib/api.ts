import { Course, CourseVariant, Plan, PlanCourse, CourseFilters, User, AuthResponse, termLabel } from "@/types";
import { mockCourses, mockPlans, mockPlanCourses, mockPresets, mockPresetCourses, mockUsers } from "./mock-data";
import { isDatabaseAvailable } from "./db";
import * as dbApi from "./db-api";

// Simulates network delay
const delay = (ms = 300) => new Promise(res => setTimeout(res, ms));

// Check if we should use database or mock data
const USE_DATABASE = isDatabaseAvailable();

// In-memory mutable stores
let plans = [...mockPlans];
let planCourses = [...mockPlanCourses, ...mockPresetCourses];
let presets = [...mockPresets];
let courses = [...mockCourses];

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// ── Auth ──
// Always use mock auth for now since database auth is not yet implemented
export const authApi = {
  async login(email: string, _password: string): Promise<AuthResponse> {
    await delay();
    const emailLower = email.toLowerCase().trim();
    const user = mockUsers.find(u => u.email.toLowerCase() === emailLower);
    if (!user) throw new Error("Invalid credentials");
    return { user, token: "mock-jwt-" + user.id };
  },
  async signup(email: string, _password: string, name: string): Promise<AuthResponse> {
    await delay();
    const user: User = { id: generateId(), email, name, is_admin: false };
    return { user, token: "mock-jwt-" + user.id };
  },
};

// ── Courses ──
export const coursesApi = USE_DATABASE ? dbApi.coursesApi : {
  async getAll(filters?: CourseFilters): Promise<Course[]> {
    await delay(200);
    let result = [...courses];
    if (filters) {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(c =>
          c.external_course_code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        );
      }
      if (filters.subject) result = result.filter(c => c.subject === filters.subject);
      if (filters.grades.length) result = result.filter(c => c.eligible_grades.some(g => filters.grades.includes(g)));
      if (filters.tags.length) result = result.filter(c => c.tags.some(t => filters.tags.includes(t)));
      if (filters.minCredits !== undefined) result = result.filter(c => c.credits >= filters.minCredits!);
      if (filters.maxCredits !== undefined) result = result.filter(c => c.credits <= filters.maxCredits!);
      if (filters.minGpaWeight !== undefined) result = result.filter(c => c.gpa_weight >= filters.minGpaWeight!);
      if (filters.maxGpaWeight !== undefined) result = result.filter(c => c.gpa_weight <= filters.maxGpaWeight!);
    }
    return result;
  },
  async getById(id: string): Promise<Course> {
    await delay(100);
    const c = courses.find(c => c.id === id);
    if (!c) throw new Error("Course not found");
    return c;
  },
  async uploadJson(data: any[]): Promise<{ added: number; updated: number; markedNotOffered: number }> {
    await delay(500);
    const newCourses: Course[] = data.map(d => ({
      id: generateId(),
      external_course_code: d.course_id || d.courseCode || '',
      name: d.name || d.courseName || '',
      credits: d.credits ?? 0,
      length: d.length ?? 1,
      gpa_weight: d.gpa ?? 4.0,
      subject: d.subject?.name || d.subject || 'Unknown',
      is_elective: Boolean(d.elective),
      description: d.description || null,
      notes: d.requirement_notes || null,
      is_offered: true,
      term: d.term || 'Full Year',
      tags: (d.tags || []).map((t: any) => typeof t === 'string' ? t : t.symbol || '').filter(Boolean),
      eligible_grades: (d.grades_eligible || d.eligibleGrades || []).map((g: any) => typeof g === 'string' ? g : String(g.grade)),
      variants: (d.variants || []).map((v: any) => ({
        id: generateId(),
        course_id: '',
        variant_course_code: v.variant_course_code || '',
        delivery_mode: v.delivery_mode || null,
        is_virtual: v.is_virtual ?? false,
        is_summer: v.is_summer ?? false,
        term: v.term || null,
        length: v.length ?? null,
        credits: v.credits ?? null,
        is_offered: true,
      })),
    }));
    courses = [...courses, ...newCourses];
    return { added: newCourses.length, updated: 0, markedNotOffered: 0 };
  },
  async update(id: string, updates: Partial<Course> & { tags?: string[]; eligible_grades?: string[] }): Promise<Course> {
    await delay(200);
    const idx = courses.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Course not found");
    const c = courses[idx];
    courses[idx] = {
      ...c,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.credits !== undefined && { credits: updates.credits }),
      ...(updates.length !== undefined && { length: updates.length }),
      ...(updates.gpa_weight !== undefined && { gpa_weight: updates.gpa_weight }),
      ...(updates.subject !== undefined && { subject: updates.subject }),
      ...(updates.is_elective !== undefined && { is_elective: updates.is_elective }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.is_offered !== undefined && { is_offered: updates.is_offered }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      ...(updates.eligible_grades !== undefined && { eligible_grades: updates.eligible_grades }),
    };
    return courses[idx];
  },
  async create(courseData: any): Promise<Course> {
    await delay(200);
    const newCourse: Course = {
      id: generateId(),
      external_course_code: courseData.external_course_code,
      name: courseData.name,
      credits: courseData.credits ?? 0,
      length: courseData.length ?? 1,
      gpa_weight: courseData.gpa_weight ?? 4.0,
      subject: courseData.subject || 'Unknown',
      is_elective: courseData.is_elective ?? false,
      description: courseData.description || null,
      notes: courseData.notes || null,
      is_offered: true,
      term: 'Full Year',
      tags: courseData.tags || [],
      eligible_grades: courseData.eligible_grades || [],
      variants: [],
    };
    courses.push(newCourse);
    return newCourse;
  },
  async getSubjects(): Promise<string[]> {
    await delay(100);
    return [...new Set(courses.map(c => c.subject).filter(Boolean))].sort();
  },
  async getTags(): Promise<string[]> {
    await delay(100);
    return [...new Set(courses.flatMap(c => c.tags))].sort();
  },
  async getTermEligibility(_courseId: string, _grade: string): Promise<number[]> {
    await delay(50);
    // Mock: assume both semesters available
    return [1, 2];
  },
  async checkPrerequisitesMet(_courseId: string, _completedCourseCodes: string[]): Promise<{ met: boolean; unmet: string[] }> {
    await delay(50);
    // Mock: assume prerequisites are always met
    return { met: true, unmet: [] };
  },
};

// ── Variants ──
export const variantsApi = USE_DATABASE ? dbApi.variantsApi : {
  async getForCourse(courseId: string): Promise<CourseVariant[]> {
    await delay(100);
    const course = courses.find(c => c.id === courseId);
    return course?.variants || [];
  },
  async create(courseId: string, variant: Omit<CourseVariant, 'id' | 'course_id'>): Promise<CourseVariant> {
    await delay(100);
    const newVariant: CourseVariant = { ...variant, id: generateId(), course_id: courseId };
    const idx = courses.findIndex(c => c.id === courseId);
    if (idx !== -1) courses[idx].variants.push(newVariant);
    return newVariant;
  },
  async update(variantId: string, updates: Partial<CourseVariant>): Promise<CourseVariant> {
    await delay(100);
    for (const course of courses) {
      const vIdx = course.variants.findIndex(v => v.id === variantId);
      if (vIdx !== -1) {
        course.variants[vIdx] = { ...course.variants[vIdx], ...updates };
        return course.variants[vIdx];
      }
    }
    throw new Error('Variant not found');
  },
  async delete(variantId: string): Promise<void> {
    await delay(100);
    for (const course of courses) {
      const vIdx = course.variants.findIndex(v => v.id === variantId);
      if (vIdx !== -1) {
        course.variants.splice(vIdx, 1);
        return;
      }
    }
  },
};

// ── Plans ──
export const plansApi = USE_DATABASE ? dbApi.plansApi : {
  async getUserPlans(userId: string): Promise<Plan[]> {
    await delay();
    return plans.filter(p => p.owner_user_id === userId && !p.is_preset);
  },
  async getById(id: string): Promise<Plan & { courses: PlanCourse[] }> {
    await delay();
    const plan = [...plans, ...presets].find(p => p.id === id);
    if (!plan) throw new Error("Plan not found");
    const pCourses = planCourses
      .filter(pc => pc.plan_id === id)
      .map(pc => ({ ...pc, course: courses.find(c => c.id === pc.course_id) }));
    return { ...plan, courses: pCourses };
  },
  async create(userId: string, name: string, description: string): Promise<Plan> {
    await delay();
    const plan: Plan = {
      id: generateId(), owner_user_id: userId, name, description,
      is_preset: false, base_preset_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    plans.push(plan);
    return plan;
  },
  async update(id: string, data: Partial<Plan>): Promise<Plan> {
    await delay();
    const idx = plans.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Plan not found");
    plans[idx] = { ...plans[idx], ...data, updated_at: new Date().toISOString() };
    return plans[idx];
  },
  async delete(id: string): Promise<void> {
    await delay();
    plans = plans.filter(p => p.id !== id);
    planCourses = planCourses.filter(pc => pc.plan_id !== id);
  },
  async addCourse(planId: string, courseId: string, termIndex: number, yearIndex: number, gradeLevel: string): Promise<PlanCourse> {
    await delay();
    const existing = planCourses.filter(pc => pc.plan_id === planId);
    const pc: PlanCourse = {
      id: generateId(), plan_id: planId, course_id: courseId,
      variant_id: null,
      term_index: termIndex, year_index: yearIndex, grade_level: gradeLevel,
      order_index: existing.length, is_from_preset: false, locked: false, notes: null,
      course: courses.find(c => c.id === courseId),
    };
    planCourses.push(pc);
    return pc;
  },
  async removeCourse(planId: string, planCourseId: string): Promise<void> {
    await delay();
    planCourses = planCourses.filter(pc => !(pc.plan_id === planId && pc.id === planCourseId));
  },
  async reorderCourses(planId: string, updatedCourses: PlanCourse[]): Promise<void> {
    await delay(100);
    planCourses = planCourses.filter(pc => pc.plan_id !== planId);
    planCourses.push(...updatedCourses);
  },
  async exportCsv(id: string): Promise<string> {
    await delay();
    const plan = await this.getById(id);
    const header = "Course Code,Course Name,Term,Year,Grade Level,Credits\n";
    const rows = plan.courses
      .map(pc => {
        const c = pc.course!;
        return `${c.external_course_code},${c.name},${termLabel(pc.term_index)},${pc.year_index ?? ''},${pc.grade_level ?? ''},${c.credits}`;
      })
      .join("\n");
    return header + rows;
  },
  async clonePreset(presetId: string, userId: string): Promise<Plan> {
    await delay();
    const preset = await this.getById(presetId);
    const newPlan: Plan = {
      id: generateId(), owner_user_id: userId, name: preset.name + " (Copy)",
      description: preset.description, is_preset: false, base_preset_id: presetId,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    plans.push(newPlan);
    preset.courses.forEach(pc => {
      planCourses.push({ ...pc, id: generateId(), plan_id: newPlan.id, is_from_preset: true });
    });
    return newPlan;
  },
};

// ── Presets ──
export const presetsApi = USE_DATABASE ? dbApi.presetsApi : {
  async getAll(): Promise<Plan[]> {
    await delay();
    return presets;
  },
  async getById(id: string) {
    return plansApi.getById(id);
  },
  async create(data: Partial<Plan>): Promise<Plan> {
    await delay();
    const preset: Plan = {
      id: generateId(), owner_user_id: "u2", name: data.name || "New Preset",
      description: data.description || null, is_preset: true,
      base_preset_id: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    presets.push(preset);
    return preset;
  },
  async update(id: string, data: Partial<Plan>): Promise<Plan> {
    await delay();
    const idx = presets.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Preset not found");
    presets[idx] = { ...presets[idx], ...data, updated_at: new Date().toISOString() };
    return presets[idx];
  },
  async delete(id: string): Promise<void> {
    await delay();
    presets = presets.filter(p => p.id !== id);
    planCourses = planCourses.filter(pc => pc.plan_id !== id);
  },
};

// ── Admin ──
export const adminApi = USE_DATABASE ? dbApi.adminApi : {
  async getStats(): Promise<{ courses: number; users: number; plans: number; presets: number }> {
    await delay();
    const activeCourses = courses.filter(c => c.is_offered).length;
    const distinctUsers = new Set(plans.filter(p => !p.is_preset).map(p => p.owner_user_id)).size;
    const studentPlans = plans.filter(p => !p.is_preset).length;
    const presetCount = presets.length;
    return { courses: activeCourses, users: distinctUsers, plans: studentPlans, presets: presetCount };
  },
  async importCourses(): Promise<{ success: boolean; message: string; output?: string; error?: string }> {
    await delay(2000);
    throw new Error('Database import only available when database is connected');
  },
  async getImportStatus(): Promise<{ hasData: boolean; totalCourses?: number; statistics?: any }> {
    await delay();
    return { hasData: false };
  },
  async fixMissingEligibility(): Promise<{ fixed: number; errors: number }> {
    await delay();
    throw new Error('Fix eligibility only available when database is connected');
  },
  async getCoursesWithIssues() {
    await delay();
    return [];
  },
  async getCourseIdsWithIssues(): Promise<Set<string>> {
    await delay();
    return new Set();
  },
  async getCourseRelationships(_courseId: string) {
    await delay();
    return [];
  },
  async fixCourseRelationship(_relationshipId: string, _relatedCourseId: string) {
    await delay();
  },
  async deleteCourseRelationship(_relationshipId: string) {
    await delay();
  },
  async addCourseRelationship(
    _courseId: string,
    _relatedCourseId: string,
    _relationshipType: 'prerequisite' | 'corequisite' | 'recommended',
    _description?: string,
  ) {
    await delay();
  },
  async addCourseRelationshipByCode(
    _courseId: string,
    _relatedCourseCode: string,
    _relationshipType: 'prerequisite' | 'corequisite' | 'recommended',
    _description?: string,
  ) {
    await delay();
  },
  async updateRelationshipCourseCode(_relationshipId: string, _courseCode: string) {
    await delay();
  },
};
