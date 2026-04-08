-- =============================================================================
--  SMOKE TEST — Import Pipeline Staff + Student Transforms (Phase IM.3)
-- =============================================================================
--
--   *** THIS IS A SMOKE TEST, NOT A PRODUCTION SEED. ***
--
-- Seeds a small set of fixture rows into staging_teachers + staging_students
-- for the GPA (Global Prep Academy) school, runs the IM.2 transform
-- functions against them, and provides verification queries so you can
-- confirm end-to-end that:
--
--   1. Staging tables accept the right shape of row
--   2. Happy-path rows reach staff + students with the expected values
--   3. Error-path rows are marked 'error' with a helpful transform_error
--   4. Re-running the script is safe (idempotent — cleanup happens first)
--
-- Scope:
--   - Target school: GPA
--   - Run id: 'im3-smoke-test' (fixture rows are identified by this tag)
--   - Live staff rows use emails ending in @gpa-smoketest.local
--   - Live student rows use student_number = 'GPA-IM3-001' through '008'
--
-- Running this script:
--   1. Copy the whole file
--   2. Paste into Supabase SQL Editor
--   3. Execute
--   4. Scroll down for the verification queries + expected results
--
-- Cleanup when you're done:
--   The DELETE statements at the bottom of this file wipe every row the
--   smoke test created (staging + live). They're fully-working, not
--   commented — re-running the script calls them automatically before
--   re-inserting, and you can also run just the cleanup block on its own.
-- =============================================================================


-- ── Step 0: Clean slate (idempotent) ────────────────────────────────────────
-- Wipe any prior smoke test rows from both staging AND live tables so the
-- fresh fixture inserts land cleanly.

DELETE FROM public.students
WHERE student_number LIKE 'GPA-IM3-%';

DELETE FROM public.staff
WHERE email LIKE '%@gpa-smoketest.local';

DELETE FROM public.staging_students
WHERE import_run_id = 'im3-smoke-test';

DELETE FROM public.staging_teachers
WHERE import_run_id = 'im3-smoke-test';


-- ── Step 1: Seed fixture teacher rows ───────────────────────────────────────
-- 4 happy-path rows + 3 error-path rows. Each row exercises a specific
-- validation branch in import_teachers() so you can see the full matrix of
-- success and failure modes in one run.

INSERT INTO public.staging_teachers
  (import_run_id, school_code, teacher_name, email, grade_assignments, role, notes)
VALUES
  -- Happy: "First Last" + default tutor role (role column null)
  ('im3-smoke-test', 'GPA', 'Jane Doe', 'jane.doe@gpa-smoketest.local',
   'G2', NULL, 'fixture: happy path tutor'),

  -- Happy: "Last, First" + explicit Coach role
  ('im3-smoke-test', 'GPA', 'Smith, Mary', 'mary.smith@gpa-smoketest.local',
   'G3, G4', 'Coach', 'fixture: coach via last-first format'),

  -- Happy: compound first name + Principal → school_admin
  ('im3-smoke-test', 'GPA', 'Dr. Robert Principal', 'bob.principal@gpa-smoketest.local',
   NULL, 'Principal', 'fixture: school_admin, compound first'),

  -- Happy: unusual role label → defaults to tutor
  ('im3-smoke-test', 'GPA', 'Alex Rivera', 'alex.rivera@gpa-smoketest.local',
   'KG', 'Teacher', 'fixture: unrecognized role, defaults to tutor'),

  -- ERROR: missing email
  ('im3-smoke-test', 'GPA', 'No Email Teacher', '',
   'G1', 'Teacher', 'fixture: ERROR missing email'),

  -- ERROR: invalid email shape
  ('im3-smoke-test', 'GPA', 'Bad Email Teacher', 'not-an-email',
   'G1', 'Teacher', 'fixture: ERROR invalid email format'),

  -- ERROR: empty teacher_name after trim
  ('im3-smoke-test', 'GPA', '   ', 'noname@gpa-smoketest.local',
   'G1', 'Teacher', 'fixture: ERROR empty teacher_name');


-- ── Step 2: Seed fixture student rows ───────────────────────────────────────
-- 5 happy-path + 3 error-path, covering grade normalization, name format
-- parsing, and the enrollment_date default.

INSERT INTO public.staging_students
  (import_run_id, school_code, student_name, student_number, grade_raw,
   teacher_name, group_label, enrollment_date_raw, notes)
VALUES
  -- Happy: KG via "Kindergarten"
  ('im3-smoke-test', 'GPA', 'Emma Thompson', 'GPA-IM3-001', 'Kindergarten',
   'Jane Doe', 'KG Group 1', NULL, 'fixture: KG via long form'),

  -- Happy: "Last, First" name format + "3rd" grade
  ('im3-smoke-test', 'GPA', 'Lee, Marcus', 'GPA-IM3-002', '3rd',
   'Smith, Mary', 'G3 Group 1', '2025-08-20', 'fixture: last-first, 3rd'),

  -- Happy: ISO date + "Grade 1" long form
  ('im3-smoke-test', 'GPA', 'Noah Patel', 'GPA-IM3-003', 'Grade 1',
   'Alex Rivera', 'G1 Group 1', '2025-09-01', 'fixture: long form grade'),

  -- Happy: US date format (to_date fallback path)
  ('im3-smoke-test', 'GPA', 'Olivia Nguyen', 'GPA-IM3-004', 'G2',
   'Jane Doe', 'G2 Group 1', '09/15/2025', 'fixture: US date format'),

  -- Happy: single-grade number + default enrollment date (null → year start)
  ('im3-smoke-test', 'GPA', 'Liam Johnson', 'GPA-IM3-005', '4',
   'Smith, Mary', 'G4 Group 1', NULL, 'fixture: null date → year start'),

  -- ERROR: unrecognized grade
  ('im3-smoke-test', 'GPA', 'Ava Garcia', 'GPA-IM3-006', 'Pre-K',
   NULL, NULL, NULL, 'fixture: ERROR unrecognized grade'),

  -- ERROR: missing student_number
  ('im3-smoke-test', 'GPA', 'Ethan Davis', '', 'G2',
   NULL, NULL, NULL, 'fixture: ERROR missing student_number'),

  -- ERROR: empty student_name
  ('im3-smoke-test', 'GPA', '   ', 'GPA-IM3-008', 'G3',
   NULL, NULL, NULL, 'fixture: ERROR empty student_name');


-- ── Step 3: Run the transforms ──────────────────────────────────────────────

SELECT 'import_teachers' AS transform, * FROM public.import_teachers('im3-smoke-test', 'GPA');
SELECT 'import_students' AS transform, * FROM public.import_students('im3-smoke-test', 'GPA');

-- Expected:
--   import_teachers  imported=4  updated=0  skipped=0  errors=3
--   import_students  imported=5  updated=0  skipped=0  errors=3
--
-- first_errors should list 3 short descriptions per transform pointing at
-- the rows marked with 'fixture: ERROR ...' in the seed above.


-- ── Step 4: Verify live table inserts ──────────────────────────────────────

-- Staff landed in live staff table: 4 rows, roles normalized correctly
SELECT first_name, last_name, email, role, is_active
FROM public.staff
WHERE email LIKE '%@gpa-smoketest.local'
ORDER BY last_name;

-- Expected roles:
--   Doe,       Jane     → tutor
--   Principal, Robert   → school_admin  (first_name = 'Dr. Robert')
--   Rivera,    Alex     → tutor
--   Smith,     Mary     → coach

-- Students landed in live students table: 5 rows, grades mapped
SELECT s.first_name, s.last_name, s.student_number, gl.name AS grade, s.enrollment_date
FROM public.students s
JOIN public.grade_levels gl ON gl.grade_id = s.grade_id
WHERE s.student_number LIKE 'GPA-IM3-%'
ORDER BY s.student_number;

-- Expected:
--   GPA-IM3-001  Emma      Thompson  KG  2025-08-01  (null raw → year start)
--   GPA-IM3-002  Marcus    Lee       G3  2025-08-20
--   GPA-IM3-003  Noah      Patel     G1  2025-09-01
--   GPA-IM3-004  Olivia    Nguyen    G2  2025-09-15  (US date parsed)
--   GPA-IM3-005  Liam      Johnson   G4  2025-08-01  (null raw → year start)


-- ── Step 5: Verify staging transform_status distribution ───────────────────

SELECT 'teachers' AS kind, transform_status, COUNT(*)
FROM public.staging_teachers
WHERE import_run_id = 'im3-smoke-test'
GROUP BY transform_status
UNION ALL
SELECT 'students', transform_status, COUNT(*)
FROM public.staging_students
WHERE import_run_id = 'im3-smoke-test'
GROUP BY transform_status
ORDER BY kind, transform_status;

-- Expected:
--   students  error     3
--   students  imported  5
--   teachers  error     3
--   teachers  imported  4


-- ── Step 6: Verify error messages for the failed rows ─────────────────────

SELECT teacher_name, email, transform_error
FROM public.staging_teachers
WHERE import_run_id = 'im3-smoke-test' AND transform_status = 'error'
ORDER BY id;

-- Expected errors (roughly):
--   No Email Teacher      ''              missing email
--   Bad Email Teacher     not-an-email    invalid email format: not-an-email
--   (empty)               noname@...      could not parse teacher_name

SELECT student_name, student_number, transform_error
FROM public.staging_students
WHERE import_run_id = 'im3-smoke-test' AND transform_status = 'error'
ORDER BY id;

-- Expected errors:
--   Ava Garcia   GPA-IM3-006   unrecognized grade: Pre-K
--   Ethan Davis  (empty)        missing student_number
--   (empty)      GPA-IM3-008   could not parse student_name


-- ── Step 7: Re-run test (demonstrate idempotency + update path) ────────────
-- Reset ONE staging_teachers row back to 'pending' and change a field to
-- prove the update path works. After this second import_teachers() call,
-- updated should be 1 and imported should be 0.

UPDATE public.staging_teachers
SET transform_status = 'pending',
    teacher_name = 'Jane M. Doe'   -- middle initial added, rest unchanged
WHERE import_run_id = 'im3-smoke-test'
  AND email = 'jane.doe@gpa-smoketest.local';

SELECT 'second run (update path)' AS transform, *
FROM public.import_teachers('im3-smoke-test', 'GPA');

-- Expected: imported=0  updated=1  errors=0

-- Verify the staff row was updated in place
SELECT first_name, last_name, email, updated_at
FROM public.staff
WHERE email = 'jane.doe@gpa-smoketest.local';

-- first_name should now be 'Jane M.' (last word 'Doe' is still last_name)


-- ── Step 8: Cleanup (run when you're done testing) ─────────────────────────
-- Comment these out if you want the smoke-test rows to persist. Re-running
-- the whole script will wipe them anyway via Step 0.

-- DELETE FROM public.students
-- WHERE student_number LIKE 'GPA-IM3-%';
--
-- DELETE FROM public.staff
-- WHERE email LIKE '%@gpa-smoketest.local';
--
-- DELETE FROM public.staging_students
-- WHERE import_run_id = 'im3-smoke-test';
--
-- DELETE FROM public.staging_teachers
-- WHERE import_run_id = 'im3-smoke-test';
