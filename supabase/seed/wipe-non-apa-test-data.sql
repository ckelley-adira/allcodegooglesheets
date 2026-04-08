-- =============================================================================
--  ⚠️  DANGER ZONE — WIPE ALL NON-APA TEST DATA
-- =============================================================================
--
-- One-shot script to clear every live-table row that does NOT belong to
-- the Allegiant Preparatory Academy (APA). Preserves:
--
--   - schools rows (so the test school records still exist for later
--     real imports)
--   - academic_years rows (so future imports have their FY26 row ready)
--   - reference data (ufli_lessons, grade_levels, feature_settings)
--   - audit_log (the destruction event itself stays in the trail)
--   - APA's staff, students, groups, initial_assessments,
--     lesson_progress, weekly_snapshots, band_assignments — everything
--     that Christina built or imported by hand
--   - APA-tagged staging rows
--
-- Wipes:
--
--   - PILOT (test school from 002_test_data.sql)
--   - CCA (test data from 002_test_data.sql — real CCA import will
--     re-populate later)
--   - ADEL (Adelante test school from 002_test_data.sql)
--   - GPA (any smoke-test rows from smoke-test-im2.sql or similar)
--   - All non-APA staging_* rows from prior import runs
--
-- Run via Supabase SQL Editor. Will print NOTICE messages as it goes.
-- The DO block handles missing schools gracefully (no error if e.g.
-- ADEL was never created in this DB).
--
-- Re-runnable: safe to execute multiple times. Subsequent runs are
-- no-ops because there's nothing left to wipe.
--
-- Sanity check before running:
--   SELECT short_code, name FROM public.schools ORDER BY short_code;
-- Make sure APA appears in the list. If it doesn't, STOP — you don't
-- have anything to preserve, and this script will leave your database
-- empty.
-- =============================================================================


-- ── Step 1: Pre-flight state ────────────────────────────────────────────────
-- Show what's in each school BEFORE the wipe so you have a baseline.

SELECT s.short_code, s.name,
  (SELECT COUNT(*) FROM public.students st WHERE st.school_id = s.school_id) AS students,
  (SELECT COUNT(*) FROM public.staff sf WHERE sf.school_id = s.school_id) AS staff,
  (SELECT COUNT(*) FROM public.instructional_groups g WHERE g.school_id = s.school_id) AS groups,
  (SELECT COUNT(*) FROM public.lesson_progress lp
     JOIN public.students st ON st.student_id = lp.student_id
   WHERE st.school_id = s.school_id) AS lesson_progress
FROM public.schools s
ORDER BY s.short_code;


-- ── Step 2: Wipe each non-APA school ────────────────────────────────────────
-- Calls import_teardown_school() for each test school, but tolerates a
-- missing school code (e.g. ADEL was never created in this DB) by
-- checking existence first inside a DO block.

DO $$
DECLARE
  v_codes text[] := ARRAY['PILOT', 'CCA', 'ADEL', 'GPA'];
  v_code text;
  v_count int;
BEGIN
  FOREACH v_code IN ARRAY v_codes LOOP
    IF EXISTS (SELECT 1 FROM public.schools WHERE short_code = v_code) THEN
      -- import_teardown_school() returns a result set; PERFORM swallows it.
      -- The function logs internally; we just need it to run.
      PERFORM public.import_teardown_school(v_code);
      RAISE NOTICE '✓ Wiped %', v_code;
    ELSE
      RAISE NOTICE '⊘ Skipped % (no such school)', v_code;
    END IF;
  END LOOP;
END $$;


-- ── Step 3: Wipe non-APA staging rows ───────────────────────────────────────

DELETE FROM public.staging_lesson_progress     WHERE school_code <> 'APA';
DELETE FROM public.staging_initial_assessments WHERE school_code <> 'APA';
DELETE FROM public.staging_students            WHERE school_code <> 'APA';
DELETE FROM public.staging_teachers            WHERE school_code <> 'APA';


-- ── Step 4: Post-wipe verification ──────────────────────────────────────────
-- Should show APA with non-zero counts; every other school zero.

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

-- Staging row counts (APA rows should be the only ones remaining)
SELECT 'staging_teachers' AS table_name, school_code, COUNT(*) AS rows
FROM public.staging_teachers GROUP BY school_code
UNION ALL
SELECT 'staging_students', school_code, COUNT(*)
FROM public.staging_students GROUP BY school_code
UNION ALL
SELECT 'staging_initial_assessments', school_code, COUNT(*)
FROM public.staging_initial_assessments GROUP BY school_code
UNION ALL
SELECT 'staging_lesson_progress', school_code, COUNT(*)
FROM public.staging_lesson_progress GROUP BY school_code
ORDER BY table_name, school_code;
