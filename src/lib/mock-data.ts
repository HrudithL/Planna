import { Course, DegreePlan, PlanCourse, User } from "@/types";

export const mockUsers: User[] = [
  { id: "u1", email: "student@planna.com", name: "Alex Rivera", is_admin: false },
  { id: "u2", email: "admin@planna.com", name: "Dr. Chen", is_admin: true },
];

export const mockCourses: Course[] = [
  {
    id: "c1", course_code: "ENG101", course_name: "English I", credits: 1, gpa: 4, subject: "English",
    term: "Full Year", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Foundational English course covering grammar, composition, and literary analysis.",
    tags: ["core", "required"], eligible_grades: ["9th"],
  },
  {
    id: "c2", course_code: "ENG201", course_name: "English II", credits: 1, gpa: 4, subject: "English",
    term: "Full Year", prerequisite_text: "ENG101", corequisite_text: null,
    enrollment_notes: null, course_description: "Continuation of English I with emphasis on American literature and research writing.",
    tags: ["core", "required"], eligible_grades: ["10th"],
  },
  {
    id: "c3", course_code: "MATH110", course_name: "Algebra I", credits: 1, gpa: 4, subject: "Math",
    term: "Full Year", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Introduction to algebraic concepts including linear equations, inequalities, and functions.",
    tags: ["core", "required"], eligible_grades: ["9th"],
  },
  {
    id: "c4", course_code: "MATH210", course_name: "Geometry", credits: 1, gpa: 4, subject: "Math",
    term: "Full Year", prerequisite_text: "MATH110", corequisite_text: null,
    enrollment_notes: null, course_description: "Study of geometric shapes, proofs, transformations, and trigonometry basics.",
    tags: ["core", "required"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c5", course_code: "MATH310", course_name: "Algebra II", credits: 1, gpa: 4, subject: "Math",
    term: "Full Year", prerequisite_text: "MATH210", corequisite_text: null,
    enrollment_notes: null, course_description: "Advanced algebra including polynomials, rational expressions, and logarithms.",
    tags: ["core"], eligible_grades: ["10th", "11th"],
  },
  {
    id: "c6", course_code: "MATH410", course_name: "Pre-Calculus", credits: 1, gpa: 5, subject: "Math",
    term: "Full Year", prerequisite_text: "MATH310", corequisite_text: null,
    enrollment_notes: "Honors level", course_description: "Preparation for calculus covering advanced functions, limits, and analytical geometry.",
    tags: ["honors", "advanced"], eligible_grades: ["11th", "12th"],
  },
  {
    id: "c7", course_code: "SCI110", course_name: "Biology I", credits: 1, gpa: 4, subject: "Science",
    term: "Full Year", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Introduction to biology covering cells, genetics, evolution, and ecology.",
    tags: ["core", "required", "lab"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c8", course_code: "SCI210", course_name: "Chemistry", credits: 1, gpa: 4, subject: "Science",
    term: "Full Year", prerequisite_text: "MATH110", corequisite_text: null,
    enrollment_notes: "Lab required", course_description: "Fundamental chemistry including atomic structure, bonding, reactions, and stoichiometry.",
    tags: ["core", "lab"], eligible_grades: ["10th", "11th"],
  },
  {
    id: "c9", course_code: "SCI310", course_name: "Physics", credits: 1, gpa: 4, subject: "Science",
    term: "Full Year", prerequisite_text: "MATH310", corequisite_text: null,
    enrollment_notes: "Lab required", course_description: "Classical mechanics, waves, electricity, and magnetism.",
    tags: ["core", "lab"], eligible_grades: ["11th", "12th"],
  },
  {
    id: "c10", course_code: "SCI410", course_name: "AP Biology", credits: 1, gpa: 5, subject: "Science",
    term: "Full Year", prerequisite_text: "SCI110", corequisite_text: null,
    enrollment_notes: "AP exam fee required", course_description: "College-level biology course covering molecular biology, genetics, and ecology in depth.",
    tags: ["AP", "advanced", "lab"], eligible_grades: ["11th", "12th"],
  },
  {
    id: "c11", course_code: "SS110", course_name: "World History", credits: 1, gpa: 4, subject: "Social Studies",
    term: "Full Year", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Survey of world civilizations from ancient times to the modern era.",
    tags: ["core", "required"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c12", course_code: "SS210", course_name: "US History", credits: 1, gpa: 4, subject: "Social Studies",
    term: "Full Year", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "American history from colonial period through modern times.",
    tags: ["core", "required"], eligible_grades: ["10th", "11th"],
  },
  {
    id: "c13", course_code: "CS110", course_name: "Intro to Computer Science", credits: 1, gpa: 4, subject: "Technology",
    term: "Semester 1", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Introduction to programming concepts, computational thinking, and basic algorithms.",
    tags: ["elective", "STEM"], eligible_grades: ["9th", "10th", "11th", "12th"],
  },
  {
    id: "c14", course_code: "CS210", course_name: "AP Computer Science A", credits: 1, gpa: 5, subject: "Technology",
    term: "Full Year", prerequisite_text: "CS110", corequisite_text: null,
    enrollment_notes: "AP exam fee required", course_description: "College-level Java programming covering OOP, data structures, and algorithms.",
    tags: ["AP", "advanced", "STEM"], eligible_grades: ["10th", "11th", "12th"],
  },
  {
    id: "c15", course_code: "ART110", course_name: "Art Foundations", credits: 0.5, gpa: 4, subject: "Fine Arts",
    term: "Semester 1", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: "Materials fee $25", course_description: "Introduction to visual arts including drawing, painting, and design principles.",
    tags: ["elective", "arts"], eligible_grades: ["9th", "10th", "11th", "12th"],
  },
  {
    id: "c16", course_code: "PE110", course_name: "Physical Education", credits: 0.5, gpa: 4, subject: "Health/PE",
    term: "Semester 1", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Fitness, team sports, and health education.",
    tags: ["required"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c17", course_code: "SPAN110", course_name: "Spanish I", credits: 1, gpa: 4, subject: "World Languages",
    term: "Full Year", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Beginning Spanish language and Hispanic culture.",
    tags: ["elective", "language"], eligible_grades: ["9th", "10th", "11th", "12th"],
  },
  {
    id: "c18", course_code: "SPAN210", course_name: "Spanish II", credits: 1, gpa: 4, subject: "World Languages",
    term: "Full Year", prerequisite_text: "SPAN110", corequisite_text: null,
    enrollment_notes: null, course_description: "Intermediate Spanish with focus on conversation and grammar.",
    tags: ["elective", "language"], eligible_grades: ["10th", "11th", "12th"],
  },
  {
    id: "c19", course_code: "ENG301", course_name: "English III", credits: 1, gpa: 4, subject: "English",
    term: "Full Year", prerequisite_text: "ENG201", corequisite_text: null,
    enrollment_notes: null, course_description: "British literature and advanced composition techniques.",
    tags: ["core", "required"], eligible_grades: ["11th"],
  },
  {
    id: "c20", course_code: "ENG401", course_name: "English IV", credits: 1, gpa: 4, subject: "English",
    term: "Full Year", prerequisite_text: "ENG301", corequisite_text: null,
    enrollment_notes: null, course_description: "Senior English focusing on world literature and college-level writing.",
    tags: ["core", "required"], eligible_grades: ["12th"],
  },
  {
    id: "c21", course_code: "SS310", course_name: "Government", credits: 0.5, gpa: 4, subject: "Social Studies",
    term: "Semester 1", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Study of US government structure, Constitution, and civic participation.",
    tags: ["core", "required"], eligible_grades: ["12th"],
  },
  {
    id: "c22", course_code: "SS320", course_name: "Economics", credits: 0.5, gpa: 4, subject: "Social Studies",
    term: "Semester 2", prerequisite_text: null, corequisite_text: null,
    enrollment_notes: null, course_description: "Fundamentals of micro and macroeconomics.",
    tags: ["core", "required"], eligible_grades: ["12th"],
  },
  {
    id: "c23", course_code: "MATH510", course_name: "AP Calculus AB", credits: 1, gpa: 5, subject: "Math",
    term: "Full Year", prerequisite_text: "MATH410", corequisite_text: null,
    enrollment_notes: "AP exam fee required", course_description: "College-level calculus covering limits, derivatives, and integrals.",
    tags: ["AP", "advanced"], eligible_grades: ["12th"],
  },
  {
    id: "c24", course_code: "SCI220", course_name: "AP Chemistry", credits: 1, gpa: 5, subject: "Science",
    term: "Full Year", prerequisite_text: "SCI210", corequisite_text: null,
    enrollment_notes: "AP exam fee required", course_description: "College-level chemistry with advanced lab work.",
    tags: ["AP", "advanced", "lab"], eligible_grades: ["11th", "12th"],
  },
];

export const mockPlans: DegreePlan[] = [
  {
    id: "p1", user_id: "u1", name: "My 4-Year Plan", description: "Standard college-prep track",
    is_preset: false, preset_category: null,
    created_at: "2025-09-01T00:00:00Z", updated_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "p2", user_id: "u1", name: "STEM Focus Plan", description: "Heavy on math and science",
    is_preset: false, preset_category: null,
    created_at: "2025-10-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z",
  },
];

export const mockPlanCourses: PlanCourse[] = [
  { id: "pc1", degree_plan_id: "p1", course_id: "c1", semester: "Fall", year: 2025, grade_level: "9th", order_index: 0, notes: null },
  { id: "pc2", degree_plan_id: "p1", course_id: "c3", semester: "Fall", year: 2025, grade_level: "9th", order_index: 1, notes: null },
  { id: "pc3", degree_plan_id: "p1", course_id: "c7", semester: "Fall", year: 2025, grade_level: "9th", order_index: 2, notes: null },
  { id: "pc4", degree_plan_id: "p1", course_id: "c11", semester: "Fall", year: 2025, grade_level: "9th", order_index: 3, notes: null },
  { id: "pc5", degree_plan_id: "p1", course_id: "c17", semester: "Spring", year: 2026, grade_level: "9th", order_index: 0, notes: null },
  { id: "pc6", degree_plan_id: "p1", course_id: "c16", semester: "Spring", year: 2026, grade_level: "9th", order_index: 1, notes: null },
];

export const mockPresets: DegreePlan[] = [
  {
    id: "pr1", user_id: "u2", name: "Computer Science Track",
    description: "Recommended 4-year plan for students interested in Computer Science majors. Emphasizes math, science, and technology courses.",
    is_preset: true, preset_category: "Computer Science",
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
  {
    id: "pr2", user_id: "u2", name: "Pre-Med Pathway",
    description: "Designed for students planning to pursue pre-med or health sciences in college. Strong emphasis on sciences.",
    is_preset: true, preset_category: "Pre-Med",
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
  {
    id: "pr3", user_id: "u2", name: "Engineering Prep",
    description: "Foundation courses for future engineering students with focus on advanced math and physics.",
    is_preset: true, preset_category: "Engineering",
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
  {
    id: "pr4", user_id: "u2", name: "Business & Leadership",
    description: "Well-rounded plan for students interested in business, economics, and leadership.",
    is_preset: true, preset_category: "Business",
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
];

export const mockPresetCourses: PlanCourse[] = [
  // CS Track - 9th grade
  { id: "prc1", degree_plan_id: "pr1", course_id: "c1", semester: "Fall", year: 2025, grade_level: "9th", order_index: 0, notes: null },
  { id: "prc2", degree_plan_id: "pr1", course_id: "c3", semester: "Fall", year: 2025, grade_level: "9th", order_index: 1, notes: null },
  { id: "prc3", degree_plan_id: "pr1", course_id: "c7", semester: "Fall", year: 2025, grade_level: "9th", order_index: 2, notes: null },
  { id: "prc4", degree_plan_id: "pr1", course_id: "c13", semester: "Fall", year: 2025, grade_level: "9th", order_index: 3, notes: null },
  { id: "prc5", degree_plan_id: "pr1", course_id: "c11", semester: "Spring", year: 2026, grade_level: "9th", order_index: 0, notes: null },
  { id: "prc6", degree_plan_id: "pr1", course_id: "c17", semester: "Spring", year: 2026, grade_level: "9th", order_index: 1, notes: null },
  // CS Track - 10th grade
  { id: "prc7", degree_plan_id: "pr1", course_id: "c2", semester: "Fall", year: 2026, grade_level: "10th", order_index: 0, notes: null },
  { id: "prc8", degree_plan_id: "pr1", course_id: "c4", semester: "Fall", year: 2026, grade_level: "10th", order_index: 1, notes: null },
  { id: "prc9", degree_plan_id: "pr1", course_id: "c8", semester: "Fall", year: 2026, grade_level: "10th", order_index: 2, notes: null },
  { id: "prc10", degree_plan_id: "pr1", course_id: "c14", semester: "Fall", year: 2026, grade_level: "10th", order_index: 3, notes: null },
];

// Helper to get subjects for filter dropdown
export const SUBJECTS = [...new Set(mockCourses.map(c => c.subject))].sort();
export const ALL_TAGS = [...new Set(mockCourses.flatMap(c => c.tags))].sort();
