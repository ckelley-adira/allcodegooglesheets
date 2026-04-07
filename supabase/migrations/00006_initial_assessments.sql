-- =============================================================================
-- Adira Reads: Initial Assessments (Phase B)
-- =============================================================================
-- Captures UFLI initial assessments at three snapshots per student per year:
--   1. baseline          — beginning-of-year frozen baseline (the reference
--                          point for growth measurement)
--   2. semester_1_end    — mid-year (end of Semester 1)
--   3. semester_2_end    — end-of-year (end of Semester 2)
--
-- Each assessment writes:
--   - One header row to initial_assessments
--   - One row per scored lesson to initial_assessment_lessons
--   - Zero+ rows to assessment_component_errors (diagnostic detail for
--     Phase C — every word where the student missed at least one component)
--   - One synthetic row per Y/N lesson to lesson_progress with
--     source='assessment' so the Big Four high-water-mark logic picks it up
--     automatically. (N never undoes a prior Y; HWM semantics preserved.)
--
-- The 'baseline' snapshot is the frozen reference: once captured, it is never
-- overwritten by later snapshots — semester_1_end and semester_2_end are
-- separate rows. A student can have at most one row per (year, snapshot_type),
-- enforced by a unique constraint.
--
-- Component errors live in their own table for the diagnostic framework
-- (Phase C): rolling them up across all schools will surface the most
-- common error patterns and drive instructional priorities.
-- =============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE assessment_snapshot_type AS ENUM (
    'baseline',
    'semester_1_end',
    'semester_2_end'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'assessment' to the existing data_source enum so lesson_progress rows
-- seeded from initial assessments can be distinguished from tutor sessions.
DO $$ BEGIN
  ALTER TYPE data_source ADD VALUE IF NOT EXISTS 'assessment';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── initial_assessments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.initial_assessments (
  assessment_id        BIGSERIAL PRIMARY KEY,
  student_id           INT NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  year_id              INT NOT NULL REFERENCES public.academic_years(year_id),
  snapshot_type        assessment_snapshot_type NOT NULL,
  assessment_date      DATE NOT NULL,
  scorer_id            INT REFERENCES public.staff(staff_id),
  is_kindergarten_eoy  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Computed metrics (stored at write-time so reports don't have to recompute)
  foundational_pct     NUMERIC(5,2),
  kg_pct               NUMERIC(5,2),
  first_grade_pct      NUMERIC(5,2),
  second_grade_pct     NUMERIC(5,2),
  overall_pct          NUMERIC(5,2),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per student per year per snapshot type
  CONSTRAINT uq_assessment_per_snapshot UNIQUE (student_id, year_id, snapshot_type)
);

CREATE INDEX IF NOT EXISTS idx_initial_assessments_student_year
  ON public.initial_assessments (student_id, year_id);

CREATE INDEX IF NOT EXISTS idx_initial_assessments_year_snapshot
  ON public.initial_assessments (year_id, snapshot_type);


-- ── initial_assessment_lessons ───────────────────────────────────────────────
-- Per-lesson result for each assessment row. Only Y/N values stored —
-- unassessed lessons are simply omitted.

CREATE TABLE IF NOT EXISTS public.initial_assessment_lessons (
  id              BIGSERIAL PRIMARY KEY,
  assessment_id   BIGINT NOT NULL REFERENCES public.initial_assessments(assessment_id) ON DELETE CASCADE,
  lesson_id       INT NOT NULL REFERENCES public.ufli_lessons(lesson_id),
  status          lesson_status NOT NULL,
  CONSTRAINT uq_assessment_lesson UNIQUE (assessment_id, lesson_id),
  -- Assessments only record mastery or non-mastery, never absences
  CONSTRAINT chk_assessment_status_y_or_n CHECK (status IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_assessment_lessons_assessment
  ON public.initial_assessment_lessons (assessment_id);


-- ── assessment_component_errors ──────────────────────────────────────────────
-- Diagnostic detail: every word where the student missed at least one
-- component. Used by the Phase C diagnostic framework to surface the most
-- common error patterns across the network.

CREATE TABLE IF NOT EXISTS public.assessment_component_errors (
  id                   BIGSERIAL PRIMARY KEY,
  assessment_id        BIGINT NOT NULL REFERENCES public.initial_assessments(assessment_id) ON DELETE CASCADE,
  section_key          VARCHAR(50) NOT NULL,
  section_name         VARCHAR(100) NOT NULL,
  word                 VARCHAR(50) NOT NULL,
  components_correct   TEXT NOT NULL DEFAULT '',
  components_missed    TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_errors_assessment
  ON public.assessment_component_errors (assessment_id);

CREATE INDEX IF NOT EXISTS idx_component_errors_section
  ON public.assessment_component_errors (section_key);


-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.initial_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initial_assessment_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_component_errors ENABLE ROW LEVEL SECURITY;

-- initial_assessments: school-scoped via the parent student
DROP POLICY IF EXISTS "school_via_student" ON public.initial_assessments;
CREATE POLICY "school_via_student" ON public.initial_assessments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = initial_assessments.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = initial_assessments.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );

-- initial_assessment_lessons: school-scoped via the parent assessment's student
DROP POLICY IF EXISTS "school_via_assessment" ON public.initial_assessment_lessons;
CREATE POLICY "school_via_assessment" ON public.initial_assessment_lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.initial_assessments ia
      JOIN public.students s ON s.student_id = ia.student_id
      WHERE ia.assessment_id = initial_assessment_lessons.assessment_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.initial_assessments ia
      JOIN public.students s ON s.student_id = ia.student_id
      WHERE ia.assessment_id = initial_assessment_lessons.assessment_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );

-- assessment_component_errors: same scoping as above
DROP POLICY IF EXISTS "school_via_assessment" ON public.assessment_component_errors;
CREATE POLICY "school_via_assessment" ON public.assessment_component_errors FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.initial_assessments ia
      JOIN public.students s ON s.student_id = ia.student_id
      WHERE ia.assessment_id = assessment_component_errors.assessment_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.initial_assessments ia
      JOIN public.students s ON s.student_id = ia.student_id
      WHERE ia.assessment_id = assessment_component_errors.assessment_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );
