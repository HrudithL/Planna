import { Course, DegreePlan, PlanCourse, CourseFilters, User, AuthResponse } from "@/types";
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
export const authApi = USE_DATABASE ? dbApi.authApi : {
  async login(email: string, _password: string): Promise<AuthResponse> {
    await delay();
    const user = mockUsers.find(u => u.email === email);
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
          c.course_code.toLowerCase().includes(q) ||
          c.course_name.toLowerCase().includes(q) ||
          c.course_description?.toLowerCase().includes(q)
        );
      }
      if (filters.subject) result = result.filter(c => c.subject === filters.subject);
      if (filters.grades.length) result = result.filter(c => c.eligible_grades.some(g => filters.grades.includes(g)));
      if (filters.tags.length) result = result.filter(c => c.tags.some(t => filters.tags.includes(t)));
      if (filters.minCredits !== undefined) result = result.filter(c => c.credits >= filters.minCredits!);
      if (filters.maxCredits !== undefined) result = result.filter(c => c.credits <= filters.maxCredits!);
    }
    return result;
  },
  async getById(id: string): Promise<Course> {
    await delay(100);
    const c = courses.find(c => c.id === id);
    if (!c) throw new Error("Course not found");
    return c;
  },
  async uploadJson(data: any[]): Promise<{ added: number }> {
    await delay(500);
    const newCourses: Course[] = data.map(d => ({
      id: generateId(),
      course_code: d.courseCode,
      course_name: d.courseName,
      credits: d.credits,
      gpa: d.gpa,
      subject: d.subject,
      term: d.term,
      prerequisite_text: d.prerequisite === "n/a" ? null : d.prerequisite,
      corequisite_text: d.corequisite === "n/a" ? null : d.corequisite,
      enrollment_notes: d.enrollmentNotes === "n/a" ? null : d.enrollmentNotes,
      course_description: d.courseDescription === "n/a" ? null : d.courseDescription,
      tags: d.tags || [],
      eligible_grades: d.eligibleGrades || [],
    }));
    courses = [...courses, ...newCourses];
    return { added: newCourses.length };
  },
};

// ── Plans ──
export const plansApi = USE_DATABASE ? dbApi.plansApi : {
  async getUserPlans(userId: string): Promise<DegreePlan[]> {
    await delay();
    return plans.filter(p => p.user_id === userId && !p.is_preset);
  },
  async getById(id: string): Promise<DegreePlan & { courses: PlanCourse[] }> {
    await delay();
    const plan = [...plans, ...presets].find(p => p.id === id);
    if (!plan) throw new Error("Plan not found");
    const pCourses = planCourses
      .filter(pc => pc.degree_plan_id === id)
      .map(pc => ({ ...pc, course: courses.find(c => c.id === pc.course_id) }));
    return { ...plan, courses: pCourses };
  },
  async create(userId: string, name: string, description: string): Promise<DegreePlan> {
    await delay();
    const plan: DegreePlan = {
      id: generateId(), user_id: userId, name, description,
      is_preset: false, preset_category: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    plans.push(plan);
    return plan;
  },
  async update(id: string, data: Partial<DegreePlan>): Promise<DegreePlan> {
    await delay();
    const idx = plans.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Plan not found");
    plans[idx] = { ...plans[idx], ...data, updated_at: new Date().toISOString() };
    return plans[idx];
  },
  async delete(id: string): Promise<void> {
    await delay();
    plans = plans.filter(p => p.id !== id);
    planCourses = planCourses.filter(pc => pc.degree_plan_id !== id);
  },
  async addCourse(planId: string, courseId: string, semester: string, year: number, gradeLevel: string): Promise<PlanCourse> {
    await delay();
    const existing = planCourses.filter(pc => pc.degree_plan_id === planId);
    const pc: PlanCourse = {
      id: generateId(), degree_plan_id: planId, course_id: courseId,
      semester, year, grade_level: gradeLevel,
      order_index: existing.length, notes: null,
      course: courses.find(c => c.id === courseId),
    };
    planCourses.push(pc);
    return pc;
  },
  async removeCourse(planId: string, planCourseId: string): Promise<void> {
    await delay();
    planCourses = planCourses.filter(pc => !(pc.degree_plan_id === planId && pc.id === planCourseId));
  },
  async reorderCourses(planId: string, updatedCourses: PlanCourse[]): Promise<void> {
    await delay(100);
    planCourses = planCourses.filter(pc => pc.degree_plan_id !== planId);
    planCourses.push(...updatedCourses);
  },
  async exportCsv(id: string): Promise<string> {
    await delay();
    const plan = await this.getById(id);
    const header = "Course Code,Course Name,Semester,Year,Grade Level,Credits\n";
    const rows = plan.courses
      .map(pc => {
        const c = pc.course!;
        return `${c.course_code},${c.course_name},${pc.semester},${pc.year},${pc.grade_level},${c.credits}`;
      })
      .join("\n");
    return header + rows;
  },
  async clonePreset(presetId: string, userId: string): Promise<DegreePlan> {
    await delay();
    const preset = await this.getById(presetId);
    const newPlan: DegreePlan = {
      id: generateId(), user_id: userId, name: preset.name + " (Copy)",
      description: preset.description, is_preset: false, preset_category: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    plans.push(newPlan);
    preset.courses.forEach(pc => {
      planCourses.push({ ...pc, id: generateId(), degree_plan_id: newPlan.id });
    });
    return newPlan;
  },
};

// ── Presets ──
export const presetsApi = USE_DATABASE ? dbApi.presetsApi : {
  async getAll(): Promise<DegreePlan[]> {
    await delay();
    return presets;
  },
  async getById(id: string) {
    return plansApi.getById(id);
  },
  async create(data: Partial<DegreePlan>): Promise<DegreePlan> {
    await delay();
    const preset: DegreePlan = {
      id: generateId(), user_id: "u2", name: data.name || "New Preset",
      description: data.description || null, is_preset: true,
      preset_category: data.preset_category || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    presets.push(preset);
    return preset;
  },
  async update(id: string, data: Partial<DegreePlan>): Promise<DegreePlan> {
    await delay();
    const idx = presets.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Preset not found");
    presets[idx] = { ...presets[idx], ...data, updated_at: new Date().toISOString() };
    return presets[idx];
  },
  async delete(id: string): Promise<void> {
    await delay();
    presets = presets.filter(p => p.id !== id);
    planCourses = planCourses.filter(pc => pc.degree_plan_id !== id);
  },
};

// ── Admin ──
export const adminApi = USE_DATABASE ? dbApi.adminApi : {
  async getStats(): Promise<{ courses: number; users: number; plans: number; presets: number }> {
    await delay();
    return { courses: courses.length, users: mockUsers.length, plans: plans.length, presets: presets.length };
  },
};
