-- Schools table (for future implementation)
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    district VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uuid UUID, -- Original UUID from source system
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    credits DECIMAL(3, 1) NOT NULL DEFAULT 0,
    gpa DECIMAL(3, 2) NOT NULL DEFAULT 4.0,
    subject VARCHAR(100) NOT NULL,
    term VARCHAR(50) NOT NULL, -- "Semester 1", "Semester 2", "Full Year", etc.
    prerequisite_text TEXT, -- Store the raw prerequisite string (e.g., "n/a", "AP Seminar", "English 1")
    corequisite_text TEXT, -- Store the raw corequisite string
    enrollment_notes TEXT,
    course_description TEXT,
    elective BOOLEAN DEFAULT FALSE,
    length INTEGER DEFAULT 1, -- Number of semesters (1 or 2)
    source_endpoint TEXT, -- API endpoint where course was scraped from
    source_page_url TEXT, -- Original page URL if available
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_code)
);

-- Course tags (many-to-many relationship)
CREATE TABLE course_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL,
    tag_uuid UUID, -- Original UUID from source system
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, tag)
);

-- Eligible grades (many-to-many relationship)
CREATE TABLE course_eligible_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    grade VARCHAR(20) NOT NULL, -- "9th", "10th", "11th", "12th"
    academic_term INTEGER, -- 1 for Semester 1, 2 for Semester 2
    academic_term_name VARCHAR(50), -- "Semester 1", "Semester 2"
    can_plan BOOLEAN DEFAULT TRUE, -- Whether course can be planned in this term
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, grade, academic_term)
);

-- Course prerequisites (structured relationship for courses that reference other courses)
CREATE TABLE course_prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    prerequisite_course_id UUID REFERENCES courses(id) ON DELETE CASCADE, -- NULL if prerequisite is text-based only
    prerequisite_text VARCHAR(255), -- For prerequisites that don't match a course code/name
    is_corequisite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course-school relationship (many-to-many for future implementation)
CREATE TABLE course_schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, school_id)
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL, -- For authentication
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Degree plans (user-created plans)
CREATE TABLE degree_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_preset BOOLEAN DEFAULT FALSE, -- True for admin-created preset plans
    preset_category VARCHAR(100), -- "Computer Science", "Pre-Med", "Engineering", "Business", etc.
    created_by_user_id UUID REFERENCES users(id), -- NULL for presets, user_id for custom plans
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan courses (courses in a degree plan)
CREATE TABLE plan_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    degree_plan_id UUID NOT NULL REFERENCES degree_plans(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    semester VARCHAR(50), -- "Fall 2024", "Spring 2025", etc.
    year INTEGER,
    grade_level VARCHAR(20), -- "9th", "10th", "11th", "12th"
    order_index INTEGER, -- For ordering courses within a semester
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(degree_plan_id, course_id, semester, year)
);

-- Indexes for performance
CREATE INDEX idx_courses_course_code ON courses(course_code);
CREATE INDEX idx_courses_subject ON courses(subject);
CREATE INDEX idx_courses_uuid ON courses(uuid);
CREATE INDEX idx_course_tags_course_id ON course_tags(course_id);
CREATE INDEX idx_course_eligible_grades_course_id ON course_eligible_grades(course_id);
CREATE INDEX idx_course_prerequisites_course_id ON course_prerequisites(course_id);
CREATE INDEX idx_course_prerequisites_prerequisite_course_id ON course_prerequisites(prerequisite_course_id);
CREATE INDEX idx_course_schools_course_id ON course_schools(course_id);
CREATE INDEX idx_course_schools_school_id ON course_schools(school_id);
CREATE INDEX idx_degree_plans_user_id ON degree_plans(user_id);
CREATE INDEX idx_degree_plans_preset ON degree_plans(is_preset, preset_category);
CREATE INDEX idx_plan_courses_degree_plan_id ON plan_courses(degree_plan_id);
CREATE INDEX idx_plan_courses_course_id ON plan_courses(course_id);
CREATE INDEX idx_users_email ON users(email);