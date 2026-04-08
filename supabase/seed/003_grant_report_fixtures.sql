-- =============================================================================
-- Adira Reads: Grant Report Fixture Seed (Phase D.5b)
-- =============================================================================
-- Eight carefully-constructed G3 students at the TILT Pilot school that
-- exercise the exact edge cases the grant report composer needs to
-- handle before a funder PDF is generated in anger. Each student is
-- identified by a 'FIX-' prefixed student_number so this seed is
-- idempotent and clearly separable from real data.
--
-- Cases covered:
--
--   1. Greta Garbo      — Has current Y activity, NO baseline assessment
--   2. Clark Gable      — Has baseline, ZERO lesson_progress rows
--   3. Ingrid Bergman   — 100% attendance in window, accelerating band
--   4. Humphrey Bogart  — Crossed the L58 cliff within the window
--   5. Judy Garland     — Intervention band + Advanced Decoding archetype
--                         (Section 5.2 Swiss Cheese: high pattern knowledge
--                          coexisting with earlier-skill holes)
--   6. Audrey Hepburn   — >=20 swiss cheese gaps + Near-Proficient archetype
--                         (gap-fill flag case from Section 5.2)
--   7. Marlon Brando    — Enrolled, NO group membership
--   8. Katharine Hepburn — Enrolled, ZERO activity ever (Not Started band)
--
-- Run via Supabase SQL Editor. Safe to re-run — all inserts use
-- ON CONFLICT or pre-delete patterns scoped to FIX- student_numbers.
-- =============================================================================

DO $$
DECLARE
  v_school_id   INT;
  v_year_id     INT;
  v_grade_id    INT;
  v_group_id    INT;
  v_staff_id    INT;
  v_today       DATE := CURRENT_DATE;
  -- Student IDs (captured via RETURNING after INSERT)
  v_garbo_id       INT;
  v_gable_id       INT;
  v_bergman_id     INT;
  v_bogart_id      INT;
  v_garland_id     INT;
  v_hepburn_a_id   INT;
  v_brando_id      INT;
  v_hepburn_k_id   INT;
BEGIN
  -- ── Lookup scaffolding ──────────────────────────────────────────────
  SELECT school_id INTO v_school_id
  FROM public.schools WHERE short_code = 'PILOT';
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'TILT Pilot school not found. Run 002_test_data.sql first.';
  END IF;

  SELECT year_id INTO v_year_id
  FROM public.academic_years
  WHERE school_id = v_school_id AND is_current = TRUE;
  IF v_year_id IS NULL THEN
    RAISE EXCEPTION 'No current academic year for PILOT school.';
  END IF;

  SELECT grade_id INTO v_grade_id
  FROM public.grade_levels WHERE name = 'G3';
  IF v_grade_id IS NULL THEN
    RAISE EXCEPTION 'G3 grade level not found.';
  END IF;

  -- Pick an arbitrary active G3 group + its teacher to house fixtures
  -- that need a group membership. We don't care which group; any will do.
  SELECT g.group_id, g.staff_id
  INTO v_group_id, v_staff_id
  FROM public.instructional_groups g
  WHERE g.school_id = v_school_id
    AND g.grade_id = v_grade_id
    AND g.is_active = TRUE
  ORDER BY g.group_id
  LIMIT 1;
  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'No active G3 group at PILOT school to attach fixtures to.';
  END IF;

  -- ── Clean slate for fixture rows (idempotency) ──────────────────────
  -- lesson_progress + memberships + baselines are scoped via student_id,
  -- so delete those downstream rows first, then the students themselves.
  DELETE FROM public.lesson_progress
  WHERE student_id IN (
    SELECT student_id FROM public.students
    WHERE student_number LIKE 'FIX-%' AND school_id = v_school_id
  );
  DELETE FROM public.initial_assessment_lessons
  WHERE assessment_id IN (
    SELECT assessment_id FROM public.initial_assessments
    WHERE student_id IN (
      SELECT student_id FROM public.students
      WHERE student_number LIKE 'FIX-%' AND school_id = v_school_id
    )
  );
  DELETE FROM public.initial_assessments
  WHERE student_id IN (
    SELECT student_id FROM public.students
    WHERE student_number LIKE 'FIX-%' AND school_id = v_school_id
  );
  DELETE FROM public.band_assignments
  WHERE student_id IN (
    SELECT student_id FROM public.students
    WHERE student_number LIKE 'FIX-%' AND school_id = v_school_id
  );
  DELETE FROM public.group_memberships
  WHERE student_id IN (
    SELECT student_id FROM public.students
    WHERE student_number LIKE 'FIX-%' AND school_id = v_school_id
  );
  DELETE FROM public.students
  WHERE student_number LIKE 'FIX-%' AND school_id = v_school_id;

  -- ── Insert fixture students ─────────────────────────────────────────
  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Greta', 'Garbo', 'FIX-G3-GARBO', '2025-08-15')
  RETURNING student_id INTO v_garbo_id;

  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Clark', 'Gable', 'FIX-G3-GABLE', '2025-08-15')
  RETURNING student_id INTO v_gable_id;

  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Ingrid', 'Bergman', 'FIX-G3-BERGMAN', '2025-08-15')
  RETURNING student_id INTO v_bergman_id;

  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Humphrey', 'Bogart', 'FIX-G3-BOGART', '2025-08-15')
  RETURNING student_id INTO v_bogart_id;

  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Judy', 'Garland', 'FIX-G3-GARLAND', '2025-08-15')
  RETURNING student_id INTO v_garland_id;

  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Audrey', 'Hepburn', 'FIX-G3-HEPBURN-A', '2025-08-15')
  RETURNING student_id INTO v_hepburn_a_id;

  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Marlon', 'Brando', 'FIX-G3-BRANDO', '2025-08-15')
  RETURNING student_id INTO v_brando_id;

  INSERT INTO public.students
    (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
  VALUES
    (v_school_id, v_grade_id, 'Katharine', 'Hepburn', 'FIX-G3-HEPBURN-K', '2025-08-15')
  RETURNING student_id INTO v_hepburn_k_id;

  -- ── Group memberships (all except Brando) ───────────────────────────
  INSERT INTO public.group_memberships (group_id, student_id, is_active, joined_date)
  VALUES
    (v_group_id, v_garbo_id,     TRUE, '2025-08-15'),
    (v_group_id, v_gable_id,     TRUE, '2025-08-15'),
    (v_group_id, v_bergman_id,   TRUE, '2025-08-15'),
    (v_group_id, v_bogart_id,    TRUE, '2025-08-15'),
    (v_group_id, v_garland_id,   TRUE, '2025-08-15'),
    (v_group_id, v_hepburn_a_id, TRUE, '2025-08-15'),
    (v_group_id, v_hepburn_k_id, TRUE, '2025-08-15')
    -- Brando intentionally has no group membership
  ;

  -- ── Fixture 1: Garbo — current activity, no baseline ────────────────
  -- Give Garbo some solid recent activity: Y on a scattering of early
  -- lessons covering the last 14 days. No initial_assessment row.
  INSERT INTO public.lesson_progress
    (student_id, group_id, lesson_id, year_id, status, date_recorded, recorded_by, source)
  SELECT v_garbo_id, v_group_id, ul.lesson_id, v_year_id,
         'Y', v_today - INTERVAL '3 days', v_staff_id, 'form'
  FROM public.ufli_lessons ul
  WHERE ul.lesson_number IN (1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14);

  -- ── Fixture 2: Gable — baseline, no current activity ────────────────
  -- Insert a baseline assessment row showing mid-range mastery but ZERO
  -- lesson_progress. The composer must handle "baseline present, current
  -- computed from empty HWM set" without crashing.
  INSERT INTO public.initial_assessments
    (student_id, year_id, snapshot_type, assessment_date, is_kindergarten_eoy,
     foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct, notes)
  VALUES
    (v_gable_id, v_year_id, 'baseline', '2025-09-01', FALSE,
     55.00, NULL, NULL, NULL, 48.00, 'FIXTURE: Gable — baseline only, no session data.');

  -- ── Fixture 3: Bergman — 100% attendance + accelerating ─────────────
  -- Every session in the last 14 days was present, all Y. The group
  -- will have sessions on v_today - 14..0 (12 distinct dates), all Y.
  INSERT INTO public.lesson_progress
    (student_id, group_id, lesson_id, year_id, status, date_recorded, recorded_by, source)
  SELECT v_bergman_id, v_group_id, ul.lesson_id, v_year_id,
         'Y', v_today - (d * INTERVAL '1 day'), v_staff_id, 'form'
  FROM public.ufli_lessons ul
  CROSS JOIN generate_series(0, 11) d
  WHERE ul.lesson_number = 14 + d;  -- Lessons 14 through 25 on 12 different dates

  -- Give Bergman a baseline that shows low starting mastery so her
  -- current numbers reflect substantial growth.
  INSERT INTO public.initial_assessments
    (student_id, year_id, snapshot_type, assessment_date, is_kindergarten_eoy,
     foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct, notes)
  VALUES
    (v_bergman_id, v_year_id, 'baseline', '2025-09-01', FALSE,
     30.00, NULL, NULL, NULL, 18.00, 'FIXTURE: Bergman — low baseline, fast grower.');

  -- ── Fixture 4: Bogart — crossed L58 cliff ───────────────────────────
  -- Give Bogart a clean pass of L59 within the last week. That triggers
  -- the L58 cliff-survivor detection in the highlights DAL.
  INSERT INTO public.lesson_progress
    (student_id, group_id, lesson_id, year_id, status, date_recorded, recorded_by, source)
  SELECT v_bogart_id, v_group_id, ul.lesson_id, v_year_id,
         'Y', v_today - INTERVAL '5 days', v_staff_id, 'form'
  FROM public.ufli_lessons ul
  WHERE ul.lesson_number IN (57, 58, 59, 60);

  -- ── Fixture 5: Garland — Intervention + Advanced Decoding ──────────
  -- Swiss cheese case. Give her solid VCE + vowel teams Y activity but
  -- sparse letters/CVC. Banding engine will classify her ceiling section
  -- as something below G3 expected (Intervention band) while the
  -- nearest-centroid archetype matches Advanced Decoding.
  INSERT INTO public.lesson_progress
    (student_id, group_id, lesson_id, year_id, status, date_recorded, recorded_by, source)
  SELECT v_garland_id, v_group_id, ul.lesson_id, v_year_id,
         'Y', v_today - INTERVAL '7 days', v_staff_id, 'form'
  FROM public.ufli_lessons ul
  WHERE ul.lesson_number IN (
    -- Partial letters (~40% mastery)
    1, 2, 3, 4, 6, 7, 8, 9, 11, 12,
    -- High VCe (~85% mastery: 7 of 8 non-review lessons)
    54, 55, 56, 58, 60, 61, 62,
    -- Moderate vowel teams
    84, 85, 86, 87, 89, 90
  );

  INSERT INTO public.initial_assessments
    (student_id, year_id, snapshot_type, assessment_date, is_kindergarten_eoy,
     foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct, notes)
  VALUES
    (v_garland_id, v_year_id, 'baseline', '2025-09-01', FALSE,
     38.00, NULL, NULL, NULL, 32.00, 'FIXTURE: Garland — Swiss Cheese test case.');

  -- ── Fixture 6: Hepburn A — gap-fill flagged ─────────────────────────
  -- Near-Proficient archetype + >=20 swiss cheese gaps. Give her Y rows
  -- high in the sequence (L100+) with many holes earlier.
  INSERT INTO public.lesson_progress
    (student_id, group_id, lesson_id, year_id, status, date_recorded, recorded_by, source)
  SELECT v_hepburn_a_id, v_group_id, ul.lesson_id, v_year_id,
         'Y', v_today - INTERVAL '9 days', v_staff_id, 'form'
  FROM public.ufli_lessons ul
  WHERE ul.lesson_number IN (
    -- Sparse letters/CVC (induces swiss cheese gaps)
    1, 2, 3, 8, 14,
    -- Sparse digraphs
    42, 43, 45,
    -- Strong advanced coverage
    99, 100, 101, 102, 103, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116,
    117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127
  );

  -- ── Fixture 7: Brando — no group ────────────────────────────────────
  -- No group_memberships row, no lesson_progress. The composer should
  -- include him in students[] with groupName=null and empty attendance.
  -- Nothing to insert here.

  -- ── Fixture 8: Katharine Hepburn — enrolled but zero activity ───────
  -- Has a group membership (above) but no lesson_progress and no
  -- baseline. Band should be 'not_started'. Nothing to insert here.

  RAISE NOTICE 'Grant report fixtures seeded: 8 students at PILOT G3 (% through %)',
    v_garbo_id, v_hepburn_k_id;
END $$;
