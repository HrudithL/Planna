-- ============================================================================
-- Planna Database Schema Reset
-- ============================================================================
-- This migration drops all existing public tables and recreates a clean schema
-- focused on courses, prerequisites, eligibility, schools, and user plans.
-- ============================================================================

-- ============================================================================
-- 1. DROP ALL EXISTING TABLES
-- ============================================================================

DROP TABLE IF EXISTS public.plan_courses CASCADE;
DROP TABLE IF EXISTS public.degree_plans CASCADE;
DROP TABLE IF EXISTS public.course_import_diffs CASCADE;
DROP TABLE IF EXISTS public.course_offerings CASCADE;
DROP TABLE IF EXISTS public.course_prerequisites CASCADE;
DROP TABLE IF EXISTS public.course_schools CASCADE;
DROP TABLE IF EXISTS public.course_tags CASCADE;
DROP TABLE IF EXISTS public.course_eligible_grades CASCADE;
DROP TABLE IF EXISTS public.raw_import_payloads CASCADE;
DROP TABLE IF EXISTS public.import_runs CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.course_providers CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================================
-- 2. CREATE NEW SCHEMA TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- courses: Main course catalog
-- ----------------------------------------------------------------------------
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_course_code text UNIQUE NOT NULL,
  external_uuid uuid,
  name text NOT NULL,
  credits numeric,
  length integer,
  gpa_weight numeric,
  subject text,
  is_elective boolean NOT NULL DEFAULT false,
  
  -- Descriptions managed by Planna app (NOT from API)
  description text,
  notes text,
  
  is_offered boolean NOT NULL DEFAULT true,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_code ON public.courses(external_course_code);
CREATE INDEX idx_courses_subject ON public.courses(subject);
CREATE INDEX idx_courses_offered ON public.courses(is_offered);

-- ----------------------------------------------------------------------------
-- course_tags: Tags for courses
-- ----------------------------------------------------------------------------
CREATE TABLE public.course_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tag text NOT NULL,
  tag_uuid uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, tag)
);

CREATE INDEX idx_course_tags_course ON public.course_tags(course_id);
CREATE INDEX idx_course_tags_tag ON public.course_tags(tag);

-- ----------------------------------------------------------------------------
-- course_relationships: Prerequisites, corequisites, and recommendations
-- ----------------------------------------------------------------------------
CREATE TABLE public.course_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  related_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN ('prerequisite', 'corequisite', 'recommended')),
  group_id text,
  logic_type text CHECK (logic_type IN ('AND', 'OR')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_relationships_course ON public.course_relationships(course_id);
CREATE INDEX idx_course_relationships_related ON public.course_relationships(related_course_id);
CREATE INDEX idx_course_relationships_type ON public.course_relationships(relationship_type);
CREATE INDEX idx_course_relationships_group ON public.course_relationships(group_id);

-- ----------------------------------------------------------------------------
-- course_eligibility: Which grades and terms can take the course
-- ----------------------------------------------------------------------------
CREATE TABLE public.course_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  grade text NOT NULL,
  term_number integer,
  term_name text,
  can_plan boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, grade, term_number)
);

CREATE INDEX idx_course_eligibility_course ON public.course_eligibility(course_id);
CREATE INDEX idx_course_eligibility_grade ON public.course_eligibility(grade);

-- ----------------------------------------------------------------------------
-- course_variants: Course delivery variants (virtual, summer, different modes)
-- ----------------------------------------------------------------------------
CREATE TABLE public.course_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  variant_course_code text NOT NULL UNIQUE,
  delivery_mode text,
  is_virtual boolean NOT NULL DEFAULT false,
  is_summer boolean NOT NULL DEFAULT false,
  term text,
  length integer,
  credits numeric,
  is_offered boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_variants_course ON public.course_variants(course_id);
CREATE INDEX idx_course_variants_code ON public.course_variants(variant_course_code);
CREATE INDEX idx_course_variants_offered ON public.course_variants(is_offered);

-- ----------------------------------------------------------------------------
-- schools: Schools/campuses (data to be populated later)
-- ----------------------------------------------------------------------------
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schools_code ON public.schools(code);

-- ----------------------------------------------------------------------------
-- school_courses: Which schools offer which courses
-- ----------------------------------------------------------------------------
CREATE TABLE public.school_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  is_available boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, course_id)
);

CREATE INDEX idx_school_courses_school ON public.school_courses(school_id);
CREATE INDEX idx_school_courses_course ON public.school_courses(course_id);

-- ----------------------------------------------------------------------------
-- plans: User and preset degree plans
-- ----------------------------------------------------------------------------
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_preset boolean NOT NULL DEFAULT false,
  base_preset_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plans_owner ON public.plans(owner_user_id);
CREATE INDEX idx_plans_preset ON public.plans(is_preset);
CREATE INDEX idx_plans_base_preset ON public.plans(base_preset_id);

-- ----------------------------------------------------------------------------
-- plan_courses: Courses placed within a plan
-- ----------------------------------------------------------------------------
CREATE TABLE public.plan_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  year_index integer,
  term_index integer,
  grade_level text,
  order_index integer,
  is_from_preset boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_courses_plan ON public.plan_courses(plan_id);
CREATE INDEX idx_plan_courses_course ON public.plan_courses(course_id);
CREATE INDEX idx_plan_courses_year_term ON public.plan_courses(plan_id, year_index, term_index);

-- ============================================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. GRANT PERMISSIONS (for authenticated users)
-- ============================================================================

-- Courses are read-only for authenticated users
GRANT SELECT ON public.courses TO authenticated;
GRANT SELECT ON public.course_tags TO authenticated;
GRANT SELECT ON public.course_relationships TO authenticated;
GRANT SELECT ON public.course_eligibility TO authenticated;
GRANT SELECT ON public.course_variants TO authenticated;
GRANT SELECT ON public.schools TO authenticated;
GRANT SELECT ON public.school_courses TO authenticated;

-- Plans are user-owned
GRANT ALL ON public.plans TO authenticated;
GRANT ALL ON public.plan_courses TO authenticated;

-- Enable RLS (policies to be defined separately as needed)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_courses ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for reading course data
CREATE POLICY "Anyone can read courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Anyone can read course_tags" ON public.course_tags FOR SELECT USING (true);
CREATE POLICY "Anyone can read course_relationships" ON public.course_relationships FOR SELECT USING (true);
CREATE POLICY "Anyone can read course_eligibility" ON public.course_eligibility FOR SELECT USING (true);
CREATE POLICY "Anyone can read course_variants" ON public.course_variants FOR SELECT USING (true);
CREATE POLICY "Anyone can read schools" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Anyone can read school_courses" ON public.school_courses FOR SELECT USING (true);

-- Users can manage their own plans
CREATE POLICY "Users can view their own plans" ON public.plans FOR SELECT 
  USING (owner_user_id = auth.uid() OR is_preset = true);

CREATE POLICY "Users can create their own plans" ON public.plans FOR INSERT 
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their own plans" ON public.plans FOR UPDATE 
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their own plans" ON public.plans FOR DELETE 
  USING (owner_user_id = auth.uid());

-- Plan courses inherit plan access
CREATE POLICY "Users can view plan courses" ON public.plan_courses FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.plans 
    WHERE plans.id = plan_courses.plan_id 
    AND (plans.owner_user_id = auth.uid() OR plans.is_preset = true)
  ));

CREATE POLICY "Users can manage their plan courses" ON public.plan_courses FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.plans 
    WHERE plans.id = plan_courses.plan_id 
    AND plans.owner_user_id = auth.uid()
  ));

-- ============================================================================
-- Migration Complete
-- ============================================================================


