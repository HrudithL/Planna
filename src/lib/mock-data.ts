import { Course, Plan, PlanCourse, User, CourseVariant } from "@/types";

export const mockUsers: User[] = [
  { id: "u1", email: "student@planna.com", name: "Alex Rivera", is_admin: false },
  { id: "u2", email: "admin@planna.com", name: "Dr. Chen", is_admin: true },
];

export const mockCourses: Course[] = [
  {
    id: "c1", external_course_code: "ENG101", name: "English I", credits: 1, length: 2, gpa_weight: 4, subject: "English",
    is_elective: false, description: "Foundational English course covering grammar, composition, and literary analysis.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["9th"],
  },
  {
    id: "c2", external_course_code: "ENG201", name: "English II", credits: 1, length: 2, gpa_weight: 4, subject: "English",
    is_elective: false, description: "Continuation of English I with emphasis on American literature and research writing.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["10th"],
  },
  {
    id: "c3", external_course_code: "MATH110", name: "Algebra I", credits: 1, length: 2, gpa_weight: 4, subject: "Math",
    is_elective: false, description: "Introduction to algebraic concepts including linear equations, inequalities, and functions.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["9th"],
  },
  {
    id: "c4", external_course_code: "MATH210", name: "Geometry", credits: 1, length: 2, gpa_weight: 4, subject: "Math",
    is_elective: false, description: "Study of geometric shapes, proofs, transformations, and trigonometry basics.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c5", external_course_code: "MATH310", name: "Algebra II", credits: 1, length: 2, gpa_weight: 4, subject: "Math",
    is_elective: false, description: "Advanced algebra including polynomials, rational expressions, and logarithms.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core"], eligible_grades: ["10th", "11th"],
  },
  {
    id: "c6", external_course_code: "MATH410", name: "Pre-Calculus", credits: 1, length: 2, gpa_weight: 5, subject: "Math",
    is_elective: false, description: "Preparation for calculus covering advanced functions, limits, and analytical geometry.",
    notes: "Honors level", is_offered: true, variants: [],
    tags: ["honors", "advanced"], eligible_grades: ["11th", "12th"],
  },
  {
    id: "c7", external_course_code: "SCI110", name: "Biology I", credits: 1, length: 2, gpa_weight: 4, subject: "Science",
    is_elective: false, description: "Introduction to biology covering cells, genetics, evolution, and ecology.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required", "lab"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c8", external_course_code: "SCI210", name: "Chemistry", credits: 1, length: 2, gpa_weight: 4, subject: "Science",
    is_elective: false, description: "Fundamental chemistry including atomic structure, bonding, reactions, and stoichiometry.",
    notes: "Lab required", is_offered: true, variants: [],
    tags: ["core", "lab"], eligible_grades: ["10th", "11th"],
  },
  {
    id: "c9", external_course_code: "SCI310", name: "Physics", credits: 1, length: 2, gpa_weight: 4, subject: "Science",
    is_elective: false, description: "Classical mechanics, waves, electricity, and magnetism.",
    notes: "Lab required", is_offered: true, variants: [],
    tags: ["core", "lab"], eligible_grades: ["11th", "12th"],
  },
  {
    id: "c10", external_course_code: "SCI410", name: "AP Biology", credits: 1, length: 2, gpa_weight: 5, subject: "Science",
    is_elective: false, description: "College-level biology course covering molecular biology, genetics, and ecology in depth.",
    notes: "AP exam fee required", is_offered: true, variants: [],
    tags: ["AP", "advanced", "lab"], eligible_grades: ["11th", "12th"],
  },
  {
    id: "c11", external_course_code: "SS110", name: "World History", credits: 1, length: 2, gpa_weight: 4, subject: "Social Studies",
    is_elective: false, description: "Survey of world civilizations from ancient times to the modern era.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c12", external_course_code: "SS210", name: "US History", credits: 1, length: 2, gpa_weight: 4, subject: "Social Studies",
    is_elective: false, description: "American history from colonial period through modern times.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["10th", "11th"],
  },
  {
    id: "c13", external_course_code: "CS110", name: "Intro to Computer Science", credits: 1, length: 1, gpa_weight: 4, subject: "Technology",
    is_elective: true, description: "Introduction to programming concepts, computational thinking, and basic algorithms.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["elective", "STEM"], eligible_grades: ["9th", "10th", "11th", "12th"],
  },
  {
    id: "c14", external_course_code: "CS210", name: "AP Computer Science A", credits: 1, length: 2, gpa_weight: 5, subject: "Technology",
    is_elective: true, description: "College-level Java programming covering OOP, data structures, and algorithms.",
    notes: "AP exam fee required", is_offered: true, variants: [],
    tags: ["AP", "advanced", "STEM"], eligible_grades: ["10th", "11th", "12th"],
  },
  {
    id: "c15", external_course_code: "ART110", name: "Art Foundations", credits: 0.5, length: 1, gpa_weight: 4, subject: "Fine Arts",
    is_elective: true, description: "Introduction to visual arts including drawing, painting, and design principles.",
    notes: "Materials fee $25", is_offered: true, variants: [],
    tags: ["elective", "arts"], eligible_grades: ["9th", "10th", "11th", "12th"],
  },
  {
    id: "c16", external_course_code: "PE110", name: "Physical Education", credits: 0.5, length: 1, gpa_weight: 4, subject: "Health/PE",
    is_elective: false, description: "Fitness, team sports, and health education.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["required"], eligible_grades: ["9th", "10th"],
  },
  {
    id: "c17", external_course_code: "SPAN110", name: "Spanish I", credits: 1, length: 2, gpa_weight: 4, subject: "World Languages",
    is_elective: true, description: "Beginning Spanish language and Hispanic culture.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["elective", "language"], eligible_grades: ["9th", "10th", "11th", "12th"],
  },
  {
    id: "c18", external_course_code: "SPAN210", name: "Spanish II", credits: 1, length: 2, gpa_weight: 4, subject: "World Languages",
    is_elective: true, description: "Intermediate Spanish with focus on conversation and grammar.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["elective", "language"], eligible_grades: ["10th", "11th", "12th"],
  },
  {
    id: "c19", external_course_code: "ENG301", name: "English III", credits: 1, length: 2, gpa_weight: 4, subject: "English",
    is_elective: false, description: "British literature and advanced composition techniques.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["11th"],
  },
  {
    id: "c20", external_course_code: "ENG401", name: "English IV", credits: 1, length: 2, gpa_weight: 4, subject: "English",
    is_elective: false, description: "Senior English focusing on world literature and college-level writing.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["12th"],
  },
  {
    id: "c21", external_course_code: "SS310", name: "Government", credits: 0.5, length: 1, gpa_weight: 4, subject: "Social Studies",
    is_elective: false, description: "Study of US government structure, Constitution, and civic participation.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["12th"],
  },
  {
    id: "c22", external_course_code: "SS320", name: "Economics", credits: 0.5, length: 1, gpa_weight: 4, subject: "Social Studies",
    is_elective: false, description: "Fundamentals of micro and macroeconomics.",
    notes: null, is_offered: true, term: "Full Year", variants: [],
    tags: ["core", "required"], eligible_grades: ["12th"],
  },
  {
    id: "c23", external_course_code: "MATH510", name: "AP Calculus AB", credits: 1, length: 2, gpa_weight: 5, subject: "Math",
    is_elective: false, description: "College-level calculus covering limits, derivatives, and integrals.",
    notes: "AP exam fee required", is_offered: true, variants: [],
    tags: ["AP", "advanced"], eligible_grades: ["12th"],
  },
  {
    id: "c24", external_course_code: "SCI220", name: "AP Chemistry", credits: 1, length: 2, gpa_weight: 5, subject: "Science",
    is_elective: false, description: "College-level chemistry with advanced lab work.",
    notes: "AP exam fee required", is_offered: true, variants: [],
    tags: ["AP", "advanced", "lab"], eligible_grades: ["11th", "12th"],
  },
];

export const mockPlans: Plan[] = [
  {
    id: "p1", owner_user_id: "u1", name: "My 4-Year Plan", description: "Standard college-prep track",
    is_preset: false, base_preset_id: null,
    created_at: "2025-09-01T00:00:00Z", updated_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "p2", owner_user_id: "u1", name: "STEM Focus Plan", description: "Heavy on math and science",
    is_preset: false, base_preset_id: null,
    created_at: "2025-10-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z",
  },
];

export const mockPlanCourses: PlanCourse[] = [
  { id: "pc1", plan_id: "p1", course_id: "c1", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 0, is_from_preset: false, locked: false, notes: null },
  { id: "pc2", plan_id: "p1", course_id: "c3", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 1, is_from_preset: false, locked: false, notes: null },
  { id: "pc3", plan_id: "p1", course_id: "c7", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 2, is_from_preset: false, locked: false, notes: null },
  { id: "pc4", plan_id: "p1", course_id: "c11", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 3, is_from_preset: false, locked: false, notes: null },
  { id: "pc5", plan_id: "p1", course_id: "c17", variant_id: null, term_index: 2, year_index: 2026, grade_level: "9th", order_index: 0, is_from_preset: false, locked: false, notes: null },
  { id: "pc6", plan_id: "p1", course_id: "c16", variant_id: null, term_index: 2, year_index: 2026, grade_level: "9th", order_index: 1, is_from_preset: false, locked: false, notes: null },
];

export const mockPresets: Plan[] = [
  {
    id: "pr1", owner_user_id: "u2", name: "Computer Science Track",
    description: "Recommended 4-year plan for students interested in Computer Science majors. Emphasizes math, science, and technology courses.",
    is_preset: true, base_preset_id: null,
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
  {
    id: "pr2", owner_user_id: "u2", name: "Pre-Med Pathway",
    description: "Designed for students planning to pursue pre-med or health sciences in college. Strong emphasis on sciences.",
    is_preset: true, base_preset_id: null,
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
  {
    id: "pr3", owner_user_id: "u2", name: "Engineering Prep",
    description: "Foundation courses for future engineering students with focus on advanced math and physics.",
    is_preset: true, base_preset_id: null,
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
  {
    id: "pr4", owner_user_id: "u2", name: "Business & Leadership",
    description: "Well-rounded plan for students interested in business, economics, and leadership.",
    is_preset: true, base_preset_id: null,
    created_at: "2025-08-01T00:00:00Z", updated_at: "2025-08-01T00:00:00Z",
  },
];

export const mockPresetCourses: PlanCourse[] = [
  // CS Track - 9th grade
  { id: "prc1", plan_id: "pr1", course_id: "c1", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 0, is_from_preset: true, locked: false, notes: null },
  { id: "prc2", plan_id: "pr1", course_id: "c3", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 1, is_from_preset: true, locked: false, notes: null },
  { id: "prc3", plan_id: "pr1", course_id: "c7", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 2, is_from_preset: true, locked: false, notes: null },
  { id: "prc4", plan_id: "pr1", course_id: "c13", variant_id: null, term_index: 1, year_index: 2025, grade_level: "9th", order_index: 3, is_from_preset: true, locked: false, notes: null },
  { id: "prc5", plan_id: "pr1", course_id: "c11", variant_id: null, term_index: 2, year_index: 2026, grade_level: "9th", order_index: 0, is_from_preset: true, locked: false, notes: null },
  { id: "prc6", plan_id: "pr1", course_id: "c17", variant_id: null, term_index: 2, year_index: 2026, grade_level: "9th", order_index: 1, is_from_preset: true, locked: false, notes: null },
  // CS Track - 10th grade
  { id: "prc7", plan_id: "pr1", course_id: "c2", variant_id: null, term_index: 1, year_index: 2026, grade_level: "10th", order_index: 0, is_from_preset: true, locked: false, notes: null },
  { id: "prc8", plan_id: "pr1", course_id: "c4", variant_id: null, term_index: 1, year_index: 2026, grade_level: "10th", order_index: 1, is_from_preset: true, locked: false, notes: null },
  { id: "prc9", plan_id: "pr1", course_id: "c8", variant_id: null, term_index: 1, year_index: 2026, grade_level: "10th", order_index: 2, is_from_preset: true, locked: false, notes: null },
  { id: "prc10", plan_id: "pr1", course_id: "c14", variant_id: null, term_index: 1, year_index: 2026, grade_level: "10th", order_index: 3, is_from_preset: true, locked: false, notes: null },
];

// Helper to get subjects for filter dropdown
export const SUBJECTS = [...new Set(mockCourses.map(c => c.subject))].sort();
export const ALL_TAGS = [...new Set(mockCourses.flatMap(c => c.tags))].sort();
