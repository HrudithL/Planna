/**
 * Database-backed API layer for Planna
 * This replaces the mock data API when database is available
 */
import * as courseQueries from './db/queries/courses';
import * as planQueries from './db/queries/plans';
import * as adminQueries from './db/queries/admin';
import { isDatabaseAvailable, supabase } from './db';
import type { Course, CourseVariant, Plan, PlanCourse, CourseFilters, User, AuthResponse } from "@/types";
import { termIndexFromLabel } from "@/types";

// ── Auth ──
// NOTE: The old custom `users` table has been dropped.
// Auth should be migrated to Supabase Auth (auth.users).
// For now, auth is handled via mock data fallback.
export const authApi = {
  async login(_email: string, _password: string): Promise<AuthResponse> {
    throw new Error('Auth not yet implemented with new schema. Please use mock data mode.');
  },
  
  async signup(_email: string, _password: string, _name: string): Promise<AuthResponse> {
    throw new Error('Auth not yet implemented with new schema. Please use mock data mode.');
  },
};

// ── Courses ──
export const coursesApi = {
  /**
   * Fetch all courses enriched with tags + grades in a single RPC call.
   * Filtering is now done client-side via useCourseSearch hook.
   * This method is kept for backwards compatibility with existing code.
   */
  async getAll(_filters?: CourseFilters): Promise<Course[]> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await courseQueries.getAllCoursesEnriched();
  },
  
  async getById(id: string): Promise<Course> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    const course = await courseQueries.getCourseById(id);
    if (!course) throw new Error("Course not found");
    return course;
  },
  
  /**
   * Bulk upload courses from a JSON file.
   * Expects data in the step6_admin_upload.json format.
   * Routes through backend API to use service role key (bypasses RLS).
   */
  async uploadJson(data: any[]): Promise<{ added: number; updated: number; markedNotOffered: number }> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { added: 0, updated: 0, markedNotOffered: 0 };
    }

    // Call backend API with service role instead of direct Supabase client
    const response = await fetch('http://localhost:3001/api/admin/import-courses-from-json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Import failed' }));
      throw new Error(errorData.message || `Import failed with status ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Import failed');
    }

    // Map backend response to expected format
    return {
      added: result.stats.coursesCreated || 0,
      updated: result.stats.coursesUpdated || 0,
      markedNotOffered: result.stats.coursesMarkedNotOffered || 0,
    };
  },

  async update(id: string, updates: Partial<Course> & { tags?: string[]; eligible_grades?: string[] }): Promise<Course> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');

    return await courseQueries.updateCourse(id, updates);
  },

  async create(courseData: Parameters<typeof courseQueries.createCourse>[0]): Promise<Course> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.createCourse(courseData);
  },

  async getSubjects(): Promise<string[]> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.getSubjects();
  },

  async getTags(): Promise<string[]> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.getTags();
  },

  async getTermEligibility(courseId: string, grade: string): Promise<number[]> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.getCourseTermEligibility(courseId, grade);
  },

  async checkPrerequisitesMet(courseId: string, completedCourseCodes: string[]): Promise<{ met: boolean; unmet: string[] }> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.checkPrerequisitesMet(courseId, completedCourseCodes);
  },
};

// ── Variants ──
export const variantsApi = {
  async getForCourse(courseId: string): Promise<CourseVariant[]> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.getVariantsForCourse(courseId);
  },
  async create(courseId: string, variant: Omit<CourseVariant, 'id' | 'course_id'>): Promise<CourseVariant> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.createVariant(courseId, variant);
  },
  async update(variantId: string, updates: Partial<CourseVariant>): Promise<CourseVariant> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await courseQueries.updateVariant(variantId, updates);
  },
  async delete(variantId: string): Promise<void> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    await courseQueries.deleteVariant(variantId);
  },
};

// ── Plans ──
export const plansApi = {
  async getUserPlans(userId: string): Promise<Plan[]> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.getUserPlans(userId);
  },
  
  async getById(id: string): Promise<Plan & { courses: PlanCourse[] }> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    const plan = await planQueries.getPlanById(id);
    if (!plan) throw new Error("Plan not found");
    return plan;
  },
  
  async create(userId: string, name: string, description: string): Promise<Plan> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.createPlan(userId, name, description);
  },
  
  async update(id: string, data: Partial<Plan>): Promise<Plan> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.updatePlan(id, data);
  },
  
  async delete(id: string): Promise<void> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    await planQueries.deletePlan(id);
  },
  
  async addCourse(planId: string, courseId: string, termIndex: number, yearIndex: number, gradeLevel: string): Promise<PlanCourse> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.addCourseToPlan(planId, courseId, termIndex, yearIndex, gradeLevel);
  },
  
  async removeCourse(planId: string, planCourseId: string): Promise<void> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    await planQueries.removeCourseFromPlan(planId, planCourseId);
  },
  
  async reorderCourses(_planId: string, _updatedCourses: PlanCourse[]): Promise<void> {
    // TODO: Implement reordering in database
    throw new Error('Reordering not yet implemented');
  },
  
  async exportCsv(id: string): Promise<string> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    const plan = await planQueries.getPlanById(id);
    if (!plan) throw new Error("Plan not found");
    
    const header = "Course Code,Course Name,Term,Year,Grade Level,Credits\n";
    const rows = plan.courses
      .map(pc => {
        const c = pc.course!;
        return `${c.external_course_code},${c.name},${pc.term_index ?? ''},${pc.year_index ?? ''},${pc.grade_level ?? ''},${c.credits}`;
      })
      .join("\n");
    return header + rows;
  },
  
  async clonePreset(presetId: string, userId: string): Promise<Plan> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.clonePreset(presetId, userId);
  },
};

// ── Presets ──
export const presetsApi = {
  async getAll(): Promise<Plan[]> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.getAllPresets();
  },
  
  async getById(id: string) {
    return plansApi.getById(id);
  },
  
  async create(data: Partial<Plan>): Promise<Plan> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.createPreset(data.name || 'New Preset', data.description || null);
  },
  
  async update(id: string, data: Partial<Plan>): Promise<Plan> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await planQueries.updatePreset(id, data);
  },
  
  async delete(id: string): Promise<void> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    await planQueries.deletePreset(id);
  },
};

// ── Admin ──
export const adminApi = {
  async getStats(): Promise<{ courses: number; users: number; plans: number; presets: number }> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    
    return await adminQueries.getAdminStats();
  },

  async importCourses(): Promise<{ success: boolean; message: string; output?: string; error?: string }> {
    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:3001');
    const fullUrl = `${API_URL}/api/admin/import-courses`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45 * 60 * 1000);
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText || 'Server error'}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || 'Failed to import courses';
            if (errorData.error) {
              const errorDetail = typeof errorData.error === 'string' 
                ? errorData.error.substring(0, 500) 
                : String(errorData.error).substring(0, 500);
              if (errorDetail && !errorMessage.includes(errorDetail)) {
                errorMessage += `\n\nError details: ${errorDetail}`;
              }
            }
          } else {
            const text = await response.text();
            if (text) {
              errorMessage = `HTTP ${response.status}: ${text.substring(0, 500) || response.statusText || 'Server error'}`;
            }
          }
        } catch (_e) {
          // Keep the default error message
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
        throw new Error('Backend server is not running. Please start it with: npm run dev:server');
      }
      if (error?.name === 'AbortError') {
        throw new Error('Import request timed out. The import may still be running on the server.');
      }
      throw error;
    }
  },

  async getImportStatus(): Promise<{ hasData: boolean; totalCourses?: number; statistics?: any }> {
    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:3001');
    
    const response = await fetch(`${API_URL}/api/admin/import-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get import status');
    }

    return await response.json();
  },

  async fixMissingEligibility(): Promise<{ fixed: number; errors: number }> {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }

    const { data: courses, error: fetchError } = await supabase
      .from('courses')
      .select('id, external_course_code, raw_payload')
      .not('raw_payload', 'is', null);

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!courses || courses.length === 0) {
      return { fixed: 0, errors: 0 };
    }

    let fixed = 0;
    let errors = 0;

    for (const course of courses) {
      try {
        const rawPayload = course.raw_payload;
        
        let payload: any;
        if (typeof rawPayload === 'string') {
          try {
            payload = JSON.parse(rawPayload);
          } catch {
            continue;
          }
        } else {
          payload = rawPayload;
        }

        if (!payload || !Array.isArray(payload.grades_eligible)) {
          continue;
        }

        const { error: deleteError } = await supabase
          .from('course_eligibility')
          .delete()
          .eq('course_id', course.id);

        if (deleteError) {
          console.error(`Error deleting eligibility for course ${course.external_course_code}:`, deleteError);
          errors++;
          continue;
        }

        const eligibilityRows: any[] = [];
        const grades: any[] = Array.isArray(payload.grades_eligible) ? payload.grades_eligible : [];
        
        grades.forEach((g: any) => {
          if (!g || g.grade === undefined || g.grade === null) {
            return;
          }

          const terms: any[] = Array.isArray(g.academic_term_offered) ? g.academic_term_offered : [];
          
          if (terms.length > 0) {
            terms.forEach((t: any) => {
              eligibilityRows.push({
                course_id: course.id,
                grade: String(g.grade),
                term_number: t?.academic_term ?? null,
                term_name: t?.name ?? null,
                can_plan: t?.can_plan ?? true,
              });
            });
          } else {
            eligibilityRows.push({
              course_id: course.id,
              grade: String(g.grade),
              term_number: null,
              term_name: null,
              can_plan: true,
            });
          }
        });

        if (eligibilityRows.length > 0) {
          const { error: insertError } = await supabase
            .from('course_eligibility')
            .insert(eligibilityRows);

          if (insertError) {
            console.error(`Error inserting eligibility for course ${course.external_course_code}:`, insertError);
            errors++;
          } else {
            fixed++;
          }
        }
      } catch (error: any) {
        console.error(`Error processing course ${course.external_course_code}:`, error);
        errors++;
      }
    }

    return { fixed, errors };
  },

  async getCoursesWithIssues() {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await adminQueries.getCoursesWithIssues();
  },

  async getCourseIdsWithIssues(): Promise<Set<string>> {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await adminQueries.getCourseIdsWithIssues();
  },

  async getCourseRelationships(courseId: string) {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    return await adminQueries.getCourseRelationships(courseId);
  },

  async fixCourseRelationship(relationshipId: string, relatedCourseId: string) {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    await adminQueries.fixCourseRelationship(relationshipId, relatedCourseId);
  },

  async deleteCourseRelationship(relationshipId: string) {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    await adminQueries.deleteCourseRelationship(relationshipId);
  },

  async addCourseRelationship(
    courseId: string,
    relatedCourseId: string,
    relationshipType: 'prerequisite' | 'corequisite' | 'recommended',
    description?: string,
  ) {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    await adminQueries.addCourseRelationship(courseId, relatedCourseId, relationshipType, description);
  },

  async addCourseRelationshipByCode(
    courseId: string,
    relatedCourseCode: string,
    relationshipType: 'prerequisite' | 'corequisite' | 'recommended',
    description?: string,
  ) {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    await adminQueries.addCourseRelationshipByCode(courseId, relatedCourseCode, relationshipType, description);
  },

  async updateRelationshipCourseCode(relationshipId: string, courseCode: string) {
    if (!isDatabaseAvailable()) throw new Error('Database not available');
    await adminQueries.updateRelationshipCourseCode(relationshipId, courseCode);
  },
};
