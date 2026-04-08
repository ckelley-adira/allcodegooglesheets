-- =============================================================================
-- Adira Reads: import_teardown_school FK nulling fix
-- =============================================================================
-- Bug: the original import_teardown_school() (migration 00011) deleted staff
-- as the last step, but several FKs from PRESERVED rows can reference the
-- staff being deleted:
--
--   lesson_progress.recorded_by  →  staff.staff_id
--   initial_assessments.scorer_id →  staff.staff_id
--   audit_log.user_id            →  staff.staff_id
--
-- Concrete failure: Christina's TILT Admin staff row (staff_id=1) lives in
-- the PILOT school. When she manually entered an APA session via the UI,
-- recorded_by got set to staff_id=1. Wiping PILOT then fails with
--
--   ERROR: 23503: update or delete on table "staff" violates foreign key
--   constraint "lesson_progress_recorded_by_fkey" on table "lesson_progress"
--   DETAIL: Key (staff_id)=(1) is still referenced from table "lesson_progress".
--
-- Fix: BEFORE deleting staff, NULL out any references from preserved tables
-- that point at the school's staff. The references are to nullable columns,
-- so SET NULL is safe. The historical attribution is lost — but the
-- alternative (failing the teardown) is worse.
--
-- The body of the function is otherwise unchanged from migration 00011.
-- =============================================================================

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

  -- ── Step 0: NULL out cross-school FKs that reference this school's staff
  -- These are references from PRESERVED rows (other schools' lesson_progress,
  -- initial_assessments, and audit_log) pointing at staff we're about to
  -- delete. SET NULL preserves the row but drops the user attribution.

  live_table := 'lesson_progress.recorded_by (cross-school nulled)';
  WITH u AS (
    UPDATE public.lesson_progress
    SET recorded_by = NULL
    WHERE recorded_by IN (
      SELECT staff_id FROM public.staff WHERE school_id = v_school_id
    )
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM u;
  RETURN NEXT;

  live_table := 'initial_assessments.scorer_id (cross-school nulled)';
  WITH u AS (
    UPDATE public.initial_assessments
    SET scorer_id = NULL
    WHERE scorer_id IN (
      SELECT staff_id FROM public.staff WHERE school_id = v_school_id
    )
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM u;
  RETURN NEXT;

  live_table := 'audit_log.user_id (cross-school nulled)';
  WITH u AS (
    UPDATE public.audit_log
    SET user_id = NULL
    WHERE user_id IN (
      SELECT staff_id FROM public.staff WHERE school_id = v_school_id
    )
    RETURNING 1
  ) SELECT COUNT(*) INTO rows_deleted FROM u;
  RETURN NEXT;

  -- ── Step 1+: Original teardown logic (unchanged from migration 00011) ──

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
