-- =============================================================================
--  ☢️ ☢️ ☢️  NUCLEAR OPTION — WIPE ALL DATA  ☢️ ☢️ ☢️
-- =============================================================================
--
-- Wipes EVERY live-table row in the database. Goes Terminator on
-- staff, students, groups, lesson_progress, initial_assessments,
-- weekly_snapshots, band_assignments, and every staging row across
-- every school. Including APA. No survivors.
--
-- PRESERVES (because future imports need them):
--
--   - schools             (CCA, GPA, APA, PILOT, ADEL — whatever exists)
--   - academic_years      (FY26 rows so import transforms have a year_id)
--   - feature_settings    (per-school flags like ufli_progress_tracking)
--   - ufli_lessons        (reference data, 128 rows)
--   - grade_levels        (reference data, 9 rows)
--
-- WIPES:
--
--   - All student/staff/group records and everything that hangs off them
--   - All lesson_progress, weekly_snapshots, band_assignments
--   - All initial_assessments, initial_assessment_lessons,
--     assessment_component_errors
--   - All instructional_sequences + sequence_lessons
--   - All staging_* table contents
--   - All audit_log entries (clean slate, no historical noise)
--
-- This script uses the existing import_teardown_school() helper
-- (migration 00015 — handles cross-school FK nulling), called for
-- every school that exists. Then drops audit_log and staging
-- contents directly.
--
-- Run via Supabase SQL Editor. Re-runnable: second run is a no-op
-- because everything's already empty.
--
-- After running this:
--   1. Re-run any seed/import scripts you need
--   2. Christina restarts the import flow per docs/import-runbook.md
-- =============================================================================


-- ── Step 1: Pre-flight — show what's about to die ───────────────────────────

SELECT s.short_code, s.name,
  (SELECT COUNT(*) FROM public.students st WHERE st.school_id = s.school_id) AS students,
  (SELECT COUNT(*) FROM public.staff sf WHERE sf.school_id = s.school_id) AS staff,
  (SELECT COUNT(*) FROM public.instructional_groups g WHERE g.school_id = s.school_id) AS groups,
  (SELECT COUNT(*) FROM public.lesson_progress lp
     JOIN public.students st ON st.student_id = lp.student_id
   WHERE st.school_id = s.school_id) AS lesson_progress
FROM public.schools s
ORDER BY s.short_code;


-- ── Step 2: Tear down EVERY school (loop over whatever exists) ──────────────

DO $$
DECLARE
  v_code text;
BEGIN
  FOR v_code IN
    SELECT short_code FROM public.schools ORDER BY short_code
  LOOP
    PERFORM public.import_teardown_school(v_code);
    RAISE NOTICE '☠ Wiped %', v_code;
  END LOOP;
END $$;


-- ── Step 3: Truncate every staging table ────────────────────────────────────

TRUNCATE TABLE
  public.staging_lesson_progress,
  public.staging_initial_assessments,
  public.staging_students,
  public.staging_teachers
RESTART IDENTITY;


-- ── Step 4: Wipe audit_log (clean slate for the post-wipe state) ────────────
-- audit_log is normally append-only by design (D-004). The teardown
-- helper preserves it on purpose. But for a "go terminator" wipe we
-- want a true clean slate, so we drop it here. The teardown event
-- itself is gone too — that's the point.

TRUNCATE TABLE public.audit_log RESTART IDENTITY;


-- ── Step 5: Reset sequences for the live tables we wiped ───────────────────
-- The teardown helper deletes rows but doesn't reset SERIAL sequences,
-- so re-imported students would start at student_id = 200 or wherever
-- the test data left off. RESTART so the next import starts at 1.
-- Skips schools/academic_years/feature_settings/ufli_lessons/grade_levels
-- because their PKs are still in use.

ALTER SEQUENCE IF EXISTS public.staff_staff_id_seq           RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.students_student_id_seq      RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.instructional_groups_group_id_seq           RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.group_memberships_membership_id_seq         RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.lesson_progress_progress_id_seq             RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.initial_assessments_assessment_id_seq       RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.initial_assessment_lessons_id_seq           RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.assessment_component_errors_id_seq          RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.weekly_snapshots_snapshot_id_seq            RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.band_assignments_band_assignment_id_seq     RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.instructional_sequences_sequence_id_seq     RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.audit_log_log_id_seq                        RESTART WITH 1;


-- ── Step 6: Post-wipe verification ──────────────────────────────────────────
-- Should show zero across the board for live data.

SELECT s.short_code, s.name,
  (SELECT COUNT(*) FROM public.students st WHERE st.school_id = s.school_id) AS students,
  (SELECT COUNT(*) FROM public.staff sf WHERE sf.school_id = s.school_id) AS staff,
  (SELECT COUNT(*) FROM public.instructional_groups g WHERE g.school_id = s.school_id) AS groups,
  (SELECT COUNT(*) FROM public.lesson_progress lp
     JOIN public.students st ON st.student_id = lp.student_id
   WHERE st.school_id = s.school_id) AS lesson_progress,
  (SELECT COUNT(*) FROM public.initial_assessments ia
     JOIN public.students st ON st.student_id = ia.student_id
   WHERE st.school_id = s.school_id) AS initial_assessments
FROM public.schools s
ORDER BY s.short_code;

-- Staging tables (should all be 0)
SELECT 'staging_teachers' AS table_name, COUNT(*) FROM public.staging_teachers
UNION ALL SELECT 'staging_students', COUNT(*) FROM public.staging_students
UNION ALL SELECT 'staging_initial_assessments', COUNT(*) FROM public.staging_initial_assessments
UNION ALL SELECT 'staging_lesson_progress', COUNT(*) FROM public.staging_lesson_progress
UNION ALL SELECT 'audit_log', COUNT(*) FROM public.audit_log
ORDER BY table_name;

-- Schools should still exist
SELECT short_code, name FROM public.schools ORDER BY short_code;

-- Academic years should still exist
SELECT s.short_code, ay.label, ay.is_current
FROM public.schools s
JOIN public.academic_years ay ON ay.school_id = s.school_id
ORDER BY s.short_code, ay.label;
