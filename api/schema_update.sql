-- ============================================================
-- MATTA schema — localized (no Supabase / auth.users dependency)
-- Safe to re-run: only adds what's missing.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- users_profile (root user table — replaces auth.users + profile)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  english_name text NULL,
  role text NOT NULL,
  department text NULL,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  avatar_path text NULL,
  phone text NULL,
  bio text NULL,
  CONSTRAINT users_profile_pkey PRIMARY KEY (id),
  CONSTRAINT users_profile_email_key UNIQUE (email),
  CONSTRAINT users_profile_role_check CHECK (
    role = ANY (ARRAY['mt'::text, 'ma_center'::text, 'mentor'::text, 'manager'::text, 'ma_board'::text, 'owner'::text])
  ),
  CONSTRAINT users_profile_status_check CHECK (
    status = ANY (ARRAY['active'::text, 'inactive'::text])
  )
) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.users_profile'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users_profile
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- trainees
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id text NOT NULL,
  batch_code text NOT NULL,
  onboard_date date NOT NULL,
  education text NULL,
  department text NULL,
  mentor_id uuid NULL,
  training_status text NOT NULL DEFAULT 'onboarding'::text,
  profile_completeness integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trainees_pkey PRIMARY KEY (id),
  CONSTRAINT trainees_user_id_key UNIQUE (user_id),
  CONSTRAINT trainees_employee_id_key UNIQUE (employee_id),
  CONSTRAINT trainees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profile (id) ON DELETE CASCADE,
  CONSTRAINT trainees_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.users_profile (id) ON DELETE SET NULL,
  CONSTRAINT trainees_profile_completeness_check CHECK (profile_completeness >= 0 AND profile_completeness <= 100),
  CONSTRAINT trainees_training_status_check CHECK (
    training_status = ANY (ARRAY['onboarding'::text, 'phase1_general'::text, 'phase2_department'::text, 'final_assessment'::text, 'graduated'::text, 'transferred'::text, 'withdrawn'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_trainees_user_id ON public.trainees USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_trainees_batch_code ON public.trainees USING btree (batch_code) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_trainees_mentor_id ON public.trainees USING btree (mentor_id) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.trainees'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trainees
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- courses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_code text NULL,
  course_name text NOT NULL,
  category text NULL,
  phase text NOT NULL,
  hours numeric(5, 1) NULL,
  instructor text NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  applicable_departments text[] NULL DEFAULT ARRAY['All'::text],
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_course_code_key UNIQUE (course_code),
  CONSTRAINT courses_phase_check CHECK (
    phase = ANY (ARRAY['phase1_general'::text, 'phase2_department'::text])
  )
) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.courses'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- assessments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL,
  assessment_type text NOT NULL,
  title text NOT NULL,
  assessment_date date NOT NULL,
  score numeric(5, 2) NULL,
  max_score numeric(5, 2) NOT NULL DEFAULT 100,
  assessor_id uuid NULL,
  comments text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assessments_pkey PRIMARY KEY (id),
  CONSTRAINT assessments_assessor_id_fkey FOREIGN KEY (assessor_id) REFERENCES public.users_profile (id) ON DELETE SET NULL,
  CONSTRAINT assessments_trainee_id_fkey FOREIGN KEY (trainee_id) REFERENCES public.trainees (id) ON DELETE CASCADE,
  CONSTRAINT assessments_assessment_type_check CHECK (
    assessment_type = ANY (ARRAY['entrance_test'::text, 'course_quiz'::text, 'monthly_test'::text, 'midterm'::text, 'final'::text, 'department_eval'::text, 'other'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_assessments_trainee ON public.assessments USING btree (trainee_id) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.assessments'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assessments
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- portfolio_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL,
  course_id uuid NULL,
  assessment_id uuid NULL,
  title text NOT NULL,
  description text NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone NULL,
  reviewed_by uuid NULL,
  review_note text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_items_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_items_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses (id) ON DELETE SET NULL,
  CONSTRAINT portfolio_items_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments (id) ON DELETE SET NULL,
  CONSTRAINT portfolio_items_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users_profile (id) ON DELETE SET NULL,
  CONSTRAINT portfolio_items_trainee_id_fkey FOREIGN KEY (trainee_id) REFERENCES public.trainees (id) ON DELETE CASCADE,
  CONSTRAINT portfolio_items_category_check CHECK (
    category = ANY (ARRAY['assignment'::text, 'reflection'::text, 'project'::text, 'qcc'::text, 'presentation'::text, 'other'::text])
  ),
  CONSTRAINT portfolio_items_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'approved'::text, 'returned'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_portfolio_items_trainee ON public.portfolio_items USING btree (trainee_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_portfolio_items_status ON public.portfolio_items USING btree (status) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.portfolio_items'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.portfolio_items
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- portfolio_files
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_item_id uuid NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  uploaded_by uuid NULL,
  CONSTRAINT portfolio_files_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_files_portfolio_item_id_fkey FOREIGN KEY (portfolio_item_id) REFERENCES public.portfolio_items (id) ON DELETE CASCADE,
  CONSTRAINT portfolio_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users_profile (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_portfolio_files_item ON public.portfolio_files USING btree (portfolio_item_id) TABLESPACE pg_default;

-- ------------------------------------------------------------
-- reviews
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  review_type text NOT NULL,
  review_period text NULL,
  rating integer NULL,
  strengths text NULL,
  areas_for_improvement text NULL,
  recommendation text NULL,
  reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  mt_reply text NULL,
  mt_reply_at timestamp with time zone NULL,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users_profile (id) ON DELETE CASCADE,
  CONSTRAINT reviews_trainee_id_fkey FOREIGN KEY (trainee_id) REFERENCES public.trainees (id) ON DELETE CASCADE,
  CONSTRAINT reviews_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  CONSTRAINT reviews_review_type_check CHECK (
    review_type = ANY (ARRAY['weekly_note'::text, 'monthly_review'::text, 'encouragement'::text, 'manager_observation'::text, 'other'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_reviews_trainee ON public.reviews USING btree (trainee_id) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.reviews'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- training_records
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL,
  course_id uuid NOT NULL,
  attendance_date date NULL,
  attended boolean NOT NULL DEFAULT false,
  test_score numeric(5, 2) NULL,
  reflection text NULL,
  completion_status text NOT NULL DEFAULT 'in_progress'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  hours numeric(4, 1) NOT NULL DEFAULT 0,
  CONSTRAINT training_records_pkey PRIMARY KEY (id),
  CONSTRAINT training_records_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses (id) ON DELETE CASCADE,
  CONSTRAINT training_records_trainee_id_fkey FOREIGN KEY (trainee_id) REFERENCES public.trainees (id) ON DELETE CASCADE,
  CONSTRAINT training_records_completion_status_check CHECK (
    completion_status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'failed'::text, 'absent'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_training_records_trainee ON public.training_records USING btree (trainee_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_training_records_course ON public.training_records USING btree (course_id) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.training_records'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.training_records
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- ------------------------------------------------------------
-- announcements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_id uuid NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users_profile (id)
) TABLESPACE pg_default;

-- ------------------------------------------------------------
-- announcement_recipients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcement_recipients (
  announcement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT announcement_recipients_pkey PRIMARY KEY (announcement_id, user_id),
  CONSTRAINT announcement_recipients_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements (id) ON DELETE CASCADE,
  CONSTRAINT announcement_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_profile (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_ann_recipients_user ON public.announcement_recipients USING btree (user_id) TABLESPACE pg_default;

-- ------------------------------------------------------------
-- trainee_resources
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainee_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL,
  uploaded_by uuid NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other'::text,
  file_name text NOT NULL,
  file_type text NULL,
  file_size_bytes bigint NULL,
  storage_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trainee_resources_pkey PRIMARY KEY (id),
  CONSTRAINT trainee_resources_trainee_id_fkey FOREIGN KEY (trainee_id) REFERENCES public.trainees (id) ON DELETE CASCADE,
  CONSTRAINT trainee_resources_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users_profile (id),
  CONSTRAINT trainee_resources_category_check CHECK (
    category = ANY (ARRAY['training_plan'::text, 'schedule'::text, 'material'::text, 'other'::text])
  )
) TABLESPACE pg_default;