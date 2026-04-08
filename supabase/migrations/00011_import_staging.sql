-- =============================================================================
-- Adira Reads: Import Pipeline Staging (Phase IM.1)
-- =============================================================================
-- Real-school data import infrastructure. Creates:
--
--   1. Two new pilot schools: Global Prep Academy (GPA) and
--      Allegiant Preparatory Academy (APA), plus their FY26
--      academic_years rows with is_current = true.
--
--   2. Four staging tables (one per legacy sheet tab):
--        staging_teachers
--        staging_students
--        staging_initial_assessments
--        staging_lesson_progress
--
--      All staging tables are intentionally permissive — TEXT columns
--      everywhere, no FK constraints, no cast validation. The CSV
--      loader (Supabase Table Editor → Import) writes raw source
--      values as-is. Transform functions in IM.2+ handle validation,
--      casting, FK matching, and upserts into the live tables.
--
--   3. import_teardown_school(p_school_code) PL/pgSQL function that
--      deletes every live-table row scoped to one school in
--      dependency order. Schools + academic_years rows are preserved
--      so the next import run can proceed immediately.
--
-- Per the import-design doc (docs/import-design.md) Q1a-Q1d:
--   - CCA already exists (will be wiped via import_teardown_school
--     before its real import)
--   - GPA is new — created here
--   - APA is new — created here (initial assessments only, staff
--     and students built by hand)
--
-- Run via Supabase SQL Editor. Safe to re-run — all DDL uses IF NOT
-- EXISTS guards and the school inserts are ON CONFLICT DO NOTHING.
-- =============================================================================


-- ── Pilot school + academic year setup ──────────────────────────────────────

INSERT INTO public.schools (name, short_code, city, state, cadence_days)
VALUES
  ('Global Prep Academy',         'GPA', 'Indianapolis', 'IN', 'TUE,THU'),
  ('Allegiant Preparatory Academy', 'APA', 'Indianapolis', 'IN', 'TUE,THU')
ON CONFLICT (short_code) DO NOTHING;

-- Ensure every pilot school has an FY26 academic year flagged is_current=true.
-- CCA already has one from the test seed; this INSERT is a safety net in case
-- the teardown helper gets run before the first real import (teardown leaves
-- academic_years alone, but the test seed may have evolved).
INSERT INTO public.academic_years (school_id, label, start_date, end_date, is_current)
SELECT s.school_id, 'FY26', '2025-08-01', '2026-06-30', TRUE
FROM public.schools s
WHERE s.short_code IN ('CCA', 'GPA', 'APA')
ON CONFLICT (school_id, label) DO NOTHING;

-- Make sure FY26 is the single current year for each pilot school
-- (an earlier seed or hand-edit might have set a different year as current).
UPDATE public.academic_years ay
SET is_current = FALSE
FROM public.schools s
WHERE ay.school_id = s.school_id
  AND s.short_code IN ('CCA', 'GPA', 'APA')
  AND ay.label <> 'FY26';

UPDATE public.academic_years ay
SET is_current = TRUE
FROM public.schools s
WHERE ay.school_id = s.school_id
  AND s.short_code IN ('CCA', 'GPA', 'APA')
  AND ay.label = 'FY26'
  AND ay.is_current = FALSE;


-- ── staging_teachers ────────────────────────────────────────────────────────
-- Source: legacy Teacher Roster tab.
-- Christina adds 'email' and 'school_code' columns to the CSV before upload;
-- all other columns are informational (grade_assignments, notes).

CREATE TABLE IF NOT EXISTS public.staging_teachers (
  id                 BIGSERIAL PRIMARY KEY,
  import_run_id      TEXT NOT NULL,
  school_code        TEXT NOT NULL,
  teacher_name       TEXT NOT NULL,
  email              TEXT NOT NULL,
  grade_assignments  TEXT,
  role               TEXT, -- 'tutor' | 'coach' | 'school_admin' — nullable, defaults to tutor in transform
  notes              TEXT,
  imported_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  transform_status   TEXT NOT NULL DEFAULT 'pending',
  transform_error    TEXT
);

CREATE INDEX IF NOT EXISTS idx_staging_teachers_run_school
  ON public.staging_teachers (import_run_id, school_code);


-- ── staging_students ────────────────────────────────────────────────────────
-- Source: legacy Student Roster tab.
-- Christina adds 'school_code' and 'student_number' columns before upload.
-- teacher_name and group_label are informational — kept for Christina's
-- manual group-building step, not written to the live students table.

CREATE TABLE IF NOT EXISTS public.staging_students (
  id                   BIGSERIAL PRIMARY KEY,
  import_run_id        TEXT NOT NULL,
  school_code          TEXT NOT NULL,
  student_name         TEXT NOT NULL,
  student_number       TEXT NOT NULL,
  grade_raw            TEXT NOT NULL,
  teacher_name         TEXT,
  group_label          TEXT,
  enrollment_date_raw  TEXT,
  notes                TEXT,
  imported_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  transform_status     TEXT NOT NULL DEFAULT 'pending',
  transform_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_staging_students_run_school
  ON public.staging_students (import_run_id, school_code);


-- ── staging_initial_assessments ─────────────────────────────────────────────
-- Source: legacy Initial Assessment tab (identical format to the UFLI Map).
-- One row per student. 128 wide lesson columns (l1..l128) for a 1:1 mapping
-- against the source CSV headers. Values are 'Y', 'N', 'A', or empty.
--
-- The transform function will collapse l1..l128 into a JSONB blob for
-- easier iteration, skip review lessons, and write:
--   - one row to initial_assessments
--   - one row per Y/N lesson to initial_assessment_lessons
--   - synthetic rows to lesson_progress with source='assessment'
-- (exactly like the live wizard does today).
--
-- A 128-column staging table is unusual but makes the CSV upload
-- completely zero-transform. Christina never queries this table
-- directly — the transform function reads it and writes to the
-- normalized live tables.

CREATE TABLE IF NOT EXISTS public.staging_initial_assessments (
  id               BIGSERIAL PRIMARY KEY,
  import_run_id    TEXT NOT NULL,
  school_code      TEXT NOT NULL,
  student_name     TEXT NOT NULL,
  assessment_date  TEXT NOT NULL,
  l1   TEXT, l2   TEXT, l3   TEXT, l4   TEXT, l5   TEXT, l6   TEXT, l7   TEXT, l8   TEXT,
  l9   TEXT, l10  TEXT, l11  TEXT, l12  TEXT, l13  TEXT, l14  TEXT, l15  TEXT, l16  TEXT,
  l17  TEXT, l18  TEXT, l19  TEXT, l20  TEXT, l21  TEXT, l22  TEXT, l23  TEXT, l24  TEXT,
  l25  TEXT, l26  TEXT, l27  TEXT, l28  TEXT, l29  TEXT, l30  TEXT, l31  TEXT, l32  TEXT,
  l33  TEXT, l34  TEXT, l35  TEXT, l36  TEXT, l37  TEXT, l38  TEXT, l39  TEXT, l40  TEXT,
  l41  TEXT, l42  TEXT, l43  TEXT, l44  TEXT, l45  TEXT, l46  TEXT, l47  TEXT, l48  TEXT,
  l49  TEXT, l50  TEXT, l51  TEXT, l52  TEXT, l53  TEXT, l54  TEXT, l55  TEXT, l56  TEXT,
  l57  TEXT, l58  TEXT, l59  TEXT, l60  TEXT, l61  TEXT, l62  TEXT, l63  TEXT, l64  TEXT,
  l65  TEXT, l66  TEXT, l67  TEXT, l68  TEXT, l69  TEXT, l70  TEXT, l71  TEXT, l72  TEXT,
  l73  TEXT, l74  TEXT, l75  TEXT, l76  TEXT, l77  TEXT, l78  TEXT, l79  TEXT, l80  TEXT,
  l81  TEXT, l82  TEXT, l83  TEXT, l84  TEXT, l85  TEXT, l86  TEXT, l87  TEXT, l88  TEXT,
  l89  TEXT, l90  TEXT, l91  TEXT, l92  TEXT, l93  TEXT, l94  TEXT, l95  TEXT, l96  TEXT,
  l97  TEXT, l98  TEXT, l99  TEXT, l100 TEXT, l101 TEXT, l102 TEXT, l103 TEXT, l104 TEXT,
  l105 TEXT, l106 TEXT, l107 TEXT, l108 TEXT, l109 TEXT, l110 TEXT, l111 TEXT, l112 TEXT,
  l113 TEXT, l114 TEXT, l115 TEXT, l116 TEXT, l117 TEXT, l118 TEXT, l119 TEXT, l120 TEXT,
  l121 TEXT, l122 TEXT, l123 TEXT, l124 TEXT, l125 TEXT, l126 TEXT, l127 TEXT, l128 TEXT,
  notes            TEXT,
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  transform_status TEXT NOT NULL DEFAULT 'pending',
  transform_error  TEXT
);

CREATE INDEX IF NOT EXISTS idx_staging_initial_assessments_run_school
  ON public.staging_initial_assessments (import_run_id, school_code);


-- ── staging_lesson_progress ─────────────────────────────────────────────────
-- Source: legacy Small Group Progress tab.
-- group_label matches instructional_groups.group_name for the school. The
-- transform joins staging_lesson_progress → instructional_groups via
-- (school_id, group_name) after Christina manually builds the groups.

CREATE TABLE IF NOT EXISTS public.staging_lesson_progress (
  id                 BIGSERIAL PRIMARY KEY,
  import_run_id      TEXT NOT NULL,
  school_code        TEXT NOT NULL,
  date_recorded_raw  TEXT NOT NULL,
  group_label        TEXT NOT NULL,
  student_name       TEXT NOT NULL,
  lesson_number      INT NOT NULL,
  status             TEXT NOT NULL, -- 'Y' | 'N' | 'A'
  notes              TEXT,
  imported_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  transform_status   TEXT NOT NULL DEFAULT 'pending',
  transform_error    TEXT
);

CREATE INDEX IF NOT EXISTS idx_staging_lesson_progress_run_school
  ON public.staging_lesson_progress (import_run_id, school_code);


-- ── RLS: staging tables are TILT Admin only ─────────────────────────────────
-- They contain PII (student names, teacher emails) but aren't scoped by
-- school_id the way live tables are — the staging tables hold rows for
-- multiple schools in one upload run. Restrict access entirely to TILT
-- Admin users, who are the only ones running imports.

ALTER TABLE public.staging_teachers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_initial_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_lesson_progress     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tilt_admin_only" ON public.staging_teachers;
CREATE POLICY "tilt_admin_only" ON public.staging_teachers FOR ALL
  USING (public.is_tilt_admin()) WITH CHECK (public.is_tilt_admin());

DROP POLICY IF EXISTS "tilt_admin_only" ON public.staging_students;
CREATE POLICY "tilt_admin_only" ON public.staging_students FOR ALL
  USING (public.is_tilt_admin()) WITH CHECK (public.is_tilt_admin());

DROP POLICY IF EXISTS "tilt_admin_only" ON public.staging_initial_assessments;
CREATE POLICY "tilt_admin_only" ON public.staging_initial_assessments FOR ALL
  USING (public.is_tilt_admin()) WITH CHECK (public.is_tilt_admin());

DROP POLICY IF EXISTS "tilt_admin_only" ON public.staging_lesson_progress;
CREATE POLICY "tilt_admin_only" ON public.staging_lesson_progress FOR ALL
  USING (public.is_tilt_admin()) WITH CHECK (public.is_tilt_admin());


-- ── import_teardown_school(p_school_code) ──────────────────────────────────
-- Deletes every live-table row scoped to one school in dependency order.
-- Leaves schools, academic_years, staging_*, and audit_log alone.
--
-- Returns a table of (live_table_name, rows_deleted) so the caller can
-- verify the teardown. Raises an exception if the short_code doesn't match
-- an existing school.
--
-- Pilot-phase tool only. Once a school has real teacher usage, this
-- function should be removed or require an explicit confirmation parameter.

CREATE OR REPLACE FUNCTION public.import_teardown_school(p_school_code text)
RETURNS TABLE (live_table text, rows_deleted bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_school_id int;
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.schools
  WHERE short_code = p_school_code;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'import_teardown_school: no school found with short_code = %', p_school_code;
  END IF;

  -- Leaves first (no incoming FKs) — band_assignments, weekly_snapshots,
  -- assessment_component_errors, initial_assessment_lessons.

  live_table := 'band_assignments';
  WITH d AS (
    DELETE FROM public.band_assignments ba
    USING public.students s
    WHERE ba.student_id = s.student_id AND s.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'weekly_snapshots';
  WITH d AS (
    DELETE FROM public.weekly_snapshots ws
    USING public.students s
    WHERE ws.student_id = s.student_id AND s.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'assessment_component_errors';
  WITH d AS (
    DELETE FROM public.assessment_component_errors ace
    USING public.initial_assessments ia, public.students s
    WHERE ace.assessment_id = ia.assessment_id
      AND ia.student_id = s.student_id
      AND s.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'initial_assessment_lessons';
  WITH d AS (
    DELETE FROM public.initial_assessment_lessons ial
    USING public.initial_assessments ia, public.students s
    WHERE ial.assessment_id = ia.assessment_id
      AND ia.student_id = s.student_id
      AND s.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'initial_assessments';
  WITH d AS (
    DELETE FROM public.initial_assessments ia
    USING public.students s
    WHERE ia.student_id = s.student_id AND s.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'lesson_progress';
  WITH d AS (
    DELETE FROM public.lesson_progress lp
    USING public.students s
    WHERE lp.student_id = s.student_id AND s.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  -- Sequences + sequence lessons (scoped via group → school_id)
  live_table := 'instructional_sequence_lessons';
  WITH d AS (
    DELETE FROM public.instructional_sequence_lessons isl
    USING public.instructional_sequences seq, public.instructional_groups g
    WHERE isl.sequence_id = seq.sequence_id
      AND seq.group_id = g.group_id
      AND g.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'instructional_sequences';
  WITH d AS (
    DELETE FROM public.instructional_sequences seq
    USING public.instructional_groups g
    WHERE seq.group_id = g.group_id AND g.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'group_memberships';
  WITH d AS (
    DELETE FROM public.group_memberships gm
    USING public.instructional_groups g
    WHERE gm.group_id = g.group_id AND g.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  -- group_grades is a junction, deletes via FK cascade on instructional_groups.
  -- No explicit handling needed here.

  live_table := 'instructional_groups';
  WITH d AS (
    DELETE FROM public.instructional_groups g
    WHERE g.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'students';
  WITH d AS (
    DELETE FROM public.students s
    WHERE s.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  live_table := 'staff';
  WITH d AS (
    DELETE FROM public.staff st
    WHERE st.school_id = v_school_id
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM d;
  RETURN NEXT;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.import_teardown_school(text) IS
  'Pilot-phase teardown: deletes all live-table rows scoped to one school '
  'in dependency order. Preserves schools, academic_years, staging_*, and '
  'audit_log. Example: SELECT * FROM import_teardown_school(''CCA'');';
