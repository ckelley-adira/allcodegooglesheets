-- =============================================================================
-- Adira Reads: Band Assignments (Phase D.1)
-- =============================================================================
-- Weekly per-student band + archetype capture from the Banding Engine.
--
-- Section 5 of Adira_Reads_Future_State_Data_Model_v1.docx is the canonical
-- spec. Two dimensions, NOT collapsed:
--
--   Band       — grade-level expectation status
--                (Intervention / Not Started / On Track / Advanced)
--   Archetype  — shape of phonics knowledge, independent of band
--                (Pre-Alphabetic / Early Alphabetic / Consolidated /
--                 Advanced Decoding / Near-Proficient)
--
-- A student CAN be in the Intervention band but classified as an
-- Advanced Decoding archetype — both pieces matter for instructional
-- decisions (Section 5.1).
--
-- Band assignment is based on the highest section with >=80% mastery
-- (NOT the first failed lesson) per the Swiss Cheese finding that
-- 85.6% of students have gaps where earlier failed skills coexist
-- with later passed skills (Section 5.2).
--
-- swiss_cheese_gap_count is captured alongside the band — a student
-- with an Advanced Decoding archetype AND a high gap count is flagged
-- for targeted gap-fill, not just sequential progression.
--
-- Cadence: weekly, on Friday, after the Dashboard snapshot is computed.
-- One row per (student, year, assigned_date). The assigned_date is
-- always a Friday.
--
-- Movement types are computed on write by comparing to the previous
-- assignment: Accelerating (2+ band advances), Advancing (1 band up),
-- Stable (unchanged), Regressing (1 band down), Exiting (student met
-- exit criteria), Initial (first ever assignment).
-- =============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE band_level AS ENUM (
    'not_started',
    'intervention',
    'on_track',
    'advanced'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE student_archetype AS ENUM (
    'pre_alphabetic',
    'early_alphabetic',
    'consolidated',
    'advanced_decoding',
    'near_proficient'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE band_movement AS ENUM (
    'initial',
    'accelerating',
    'advancing',
    'stable',
    'regressing',
    'exiting'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── band_assignments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.band_assignments (
  band_assignment_id       BIGSERIAL PRIMARY KEY,
  student_id               INT NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  year_id                  INT NOT NULL REFERENCES public.academic_years(year_id),
  assigned_date            DATE NOT NULL,
  band                     band_level NOT NULL,
  archetype                student_archetype NOT NULL,
  movement                 band_movement NOT NULL DEFAULT 'initial',
  -- Snapshot of the student's grade at time of assignment (denormalized
  -- so historical rows remain meaningful after a grade change)
  grade_name               VARCHAR(10),
  -- The highest skill section where the student has >=80% mastery.
  -- null means no section has crossed the threshold yet.
  ceiling_section          VARCHAR(100),
  -- Highest non-review lesson the student has ever passed (Y).
  -- Used as the denominator ceiling for swiss_cheese_gap_count.
  ceiling_lesson_number    SMALLINT,
  -- Count of unpassed non-review lessons below ceiling_lesson_number
  swiss_cheese_gap_count   SMALLINT NOT NULL DEFAULT 0,
  -- The seven-bucket profile vector used for archetype classification,
  -- stored as JSONB so the debug view can show why the centroid won.
  -- Shape: { letters, cvc, blends, closed_syllable, vce, vowel_teams, advanced }
  profile_vector           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One assignment per student per year per Friday
  CONSTRAINT uq_band_per_student_date UNIQUE (student_id, year_id, assigned_date)
);

CREATE INDEX IF NOT EXISTS idx_band_assignments_student_year
  ON public.band_assignments (student_id, year_id, assigned_date DESC);

CREATE INDEX IF NOT EXISTS idx_band_assignments_year_date
  ON public.band_assignments (year_id, assigned_date);

CREATE INDEX IF NOT EXISTS idx_band_assignments_band_archetype
  ON public.band_assignments (band, archetype);


-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.band_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_via_student" ON public.band_assignments;
CREATE POLICY "school_via_student" ON public.band_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = band_assignments.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = band_assignments.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );
