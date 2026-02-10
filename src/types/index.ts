export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

export interface Course {
  id: string;
  course_code: string;
  course_name: string;
  credits: number;
  gpa: number;
  subject: string;
  term: string;
  prerequisite_text: string | null;
  corequisite_text: string | null;
  enrollment_notes: string | null;
  course_description: string | null;
  tags: string[];
  eligible_grades: string[];
}

export interface DegreePlan {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_preset: boolean;
  preset_category: string | null;
  created_at: string;
  updated_at: string;
  courses?: PlanCourse[];
}

export interface PlanCourse {
  id: string;
  degree_plan_id: string;
  course_id: string;
  course?: Course;
  semester: string;
  year: number;
  grade_level: string;
  order_index: number;
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
}

export const GRADE_LEVELS = ["9th", "10th", "11th", "12th"] as const;
export const SEMESTERS = ["Fall", "Spring"] as const;
export const PRESET_CATEGORIES = [
  "Computer Science",
  "Pre-Med",
  "Engineering",
  "Business",
  "Arts & Humanities",
  "STEM General",
] as const;
