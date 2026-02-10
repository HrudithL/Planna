/**
 * Database-backed API layer for Planna
 * This replaces the mock data API when database is available
 */
import * as courseQueries from './db/queries/courses';
import * as planQueries from './db/queries/plans';
import * as userQueries from './db/queries/users';
import { isDatabaseAvailable } from './db';
import type { Course, DegreePlan, PlanCourse, CourseFilters, User, AuthResponse } from "@/types";

// Simulates network delay for consistency with mock API
const delay = (ms = 200) => new Promise(res => setTimeout(res, ms));

// ── Auth ──
export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    const user = await userQueries.getUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");
    
    // TODO: Implement proper password hashing and verification
    // For now, accept any password
    return { user, token: "jwt-" + user.id };
  },
  
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    // TODO: Implement proper password hashing
    const passwordHash = password; // Temporary - should use bcrypt
    const user = await userQueries.createUser(email, name, passwordHash);
    return { user, token: "jwt-" + user.id };
  },
};

// ── Courses ──
export const coursesApi = {
  async getAll(filters?: CourseFilters): Promise<Course[]> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    let courses = await courseQueries.getAllCourses();
    
    // Apply filters client-side (could be optimized with SQL WHERE clauses)
    if (filters) {
      if (filters.search) {
        courses = await courseQueries.searchCourses(filters.search);
      }
      if (filters.subject) {
        courses = courses.filter(c => c.subject === filters.subject);
      }
      if (filters.grades && filters.grades.length) {
        courses = courses.filter(c => c.eligible_grades.some(g => filters.grades.includes(g)));
      }
      if (filters.tags && filters.tags.length) {
        courses = courses.filter(c => c.tags.some(t => filters.tags.includes(t)));
      }
      if (filters.minCredits !== undefined) {
        courses = courses.filter(c => c.credits >= filters.minCredits!);
      }
      if (filters.maxCredits !== undefined) {
        courses = courses.filter(c => c.credits <= filters.maxCredits!);
      }
    }
    
    return courses;
  },
  
  async getById(id: string): Promise<Course> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    const course = await courseQueries.getCourseById(id);
    if (!course) throw new Error("Course not found");
    return course;
  },
  
  async uploadJson(data: any[]): Promise<{ added: number }> {
    await delay();
    // TODO: Implement bulk course upload to database
    throw new Error('Database upload not yet implemented - use import scripts');
  },
};

// ── Plans ──
export const plansApi = {
  async getUserPlans(userId: string): Promise<DegreePlan[]> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.getUserPlans(userId);
  },
  
  async getById(id: string): Promise<DegreePlan & { courses: PlanCourse[] }> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    const plan = await planQueries.getPlanById(id);
    if (!plan) throw new Error("Plan not found");
    return plan;
  },
  
  async create(userId: string, name: string, description: string): Promise<DegreePlan> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.createPlan(userId, name, description);
  },
  
  async update(id: string, data: Partial<DegreePlan>): Promise<DegreePlan> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.updatePlan(id, data);
  },
  
  async delete(id: string): Promise<void> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    await planQueries.deletePlan(id);
  },
  
  async addCourse(planId: string, courseId: string, semester: string, year: number, gradeLevel: string): Promise<PlanCourse> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.addCourseToPlan(planId, courseId, semester, year, gradeLevel);
  },
  
  async removeCourse(planId: string, planCourseId: string): Promise<void> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    await planQueries.removeCourseFromPlan(planId, planCourseId);
  },
  
  async reorderCourses(planId: string, updatedCourses: PlanCourse[]): Promise<void> {
    await delay();
    // TODO: Implement reordering in database
    throw new Error('Reordering not yet implemented');
  },
  
  async exportCsv(id: string): Promise<string> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    const plan = await planQueries.getPlanById(id);
    if (!plan) throw new Error("Plan not found");
    
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
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.clonePreset(presetId, userId);
  },
};

// ── Presets ──
export const presetsApi = {
  async getAll(): Promise<DegreePlan[]> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.getAllPresets();
  },
  
  async getById(id: string) {
    return plansApi.getById(id);
  },
  
  async create(data: Partial<DegreePlan>): Promise<DegreePlan> {
    await delay();
    // TODO: Implement preset creation (admin only)
    throw new Error('Preset creation not yet implemented');
  },
  
  async update(id: string, data: Partial<DegreePlan>): Promise<DegreePlan> {
    await delay();
    // TODO: Implement preset update (admin only)
    throw new Error('Preset update not yet implemented');
  },
  
  async delete(id: string): Promise<void> {
    await delay();
    // TODO: Implement preset deletion (admin only)
    throw new Error('Preset deletion not yet implemented');
  },
};

// ── Admin ──
export const adminApi = {
  async getStats(): Promise<{ courses: number; users: number; plans: number; presets: number }> {
    await delay();
    
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    // TODO: Implement actual stats queries
    return { courses: 0, users: 0, plans: 0, presets: 0 };
  },
};



