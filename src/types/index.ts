export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

export interface CourseVariant {
  id: string;
  course_id: string;
  variant_course_code: string;
  delivery_mode: string | null;
  is_virtual: boolean;
  is_summer: boolean;
  term: string | null;
  length: number | null;
  credits: number | null;
  is_offered: boolean;
}

export interface Course {
  id: string;
  external_course_code: string;
  name: string;
  credits: number;
  length: number;
  gpa_weight: number;
  subject: string;
  is_elective: boolean;
  description: string | null;
  notes: string | null;
  is_offered: boolean;
  term: string | null;
  // Joined from related tables
  tags: string[];
  eligible_grades: string[];
  variants: CourseVariant[];
}

export interface Plan {
  id: string;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  is_preset: boolean;
  base_preset_id: string | null;
  created_at: string;
  updated_at: string;
  courses?: PlanCourse[];
}

/** @deprecated Use Plan instead */
export type DegreePlan = Plan;

export interface PlanCourse {
  id: string;
  plan_id: string;
  course_id: string;
  course?: Course;
  variant_id: string | null;
  year_index: number | null;
  term_index: number | null;
  grade_level: string | null;
  order_index: number | null;
  is_from_preset: boolean;
  locked: boolean;
  notes: string | null;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CourseFilters {
  search: string;
  subject: string;
  grades: string[];
  tags: string[];
  minCredits?: number;
  maxCredits?: number;
  minGpaWeight?: number;
  maxGpaWeight?: number;
}

// Grade level groupings
export const JUNIOR_HIGH_GRADES = ["6th", "7th", "8th"] as const;
export const HIGH_SCHOOL_GRADES = ["9th", "10th", "11th", "12th"] as const;
export const ALL_GRADE_LEVELS = [...JUNIOR_HIGH_GRADES, ...HIGH_SCHOOL_GRADES] as const;

/** @deprecated Use ALL_GRADE_LEVELS, JUNIOR_HIGH_GRADES, or HIGH_SCHOOL_GRADES */
export const GRADE_LEVELS = ALL_GRADE_LEVELS;

// Term indices for plan editor grid
export const TERMS = [
  { index: 0, label: "Summer 1", isSummer: true },
  { index: 1, label: "Summer 2", isSummer: true },
  { index: 2, label: "Fall", isSummer: false },
  { index: 3, label: "Spring", isSummer: false },
] as const;

/** @deprecated Use TERMS instead */
export const SEMESTERS = ["Fall", "Spring"] as const;

export function termLabel(termIndex: number | null): string {
  if (termIndex === null || termIndex === undefined) return "Unknown";
  const t = TERMS.find(t => t.index === termIndex);
  return t ? t.label : `Term ${termIndex}`;
}

export function termIndexFromLabel(label: string): number {
  const t = TERMS.find(t => t.label === label);
  return t ? t.index : 0;
}

/** Delivery mode display labels */
export const DELIVERY_MODE_LABELS: Record<string, string> = {
  in_person: "In Person",
  vir_sup: "Virtual (Supervised)",
  vir_inst_day: "Virtual (Instructional Day)",
  summer_virtual: "Summer Virtual",
};
