-- =============================================================================
-- Adira Reads: Test Data Seed
-- =============================================================================
-- Populates the database with three schools' worth of realistic test data
-- for development and demos. Idempotent — safe to re-run.
--
-- Schools:
--   1. TILT Pilot School (existing) — K-3, single-grade groups
--   2. Central Christian Academy (CCA) — PK-3, single-grade groups,
--      KG has two teachers
--   3. Adelante — K-G8, single-grade for K-G5, mixed-grade for G6-G8
--
-- Counts:
--   - 3 schools, 19 teachers, 72 groups, 360 students
--   - Each group has an active Instructional Sequence (8 lessons)
--   - Each student has 5 lesson_progress rows (covering the first 5
--     lessons of their group's sequence) spanning the past 5 weeks
--   - Performance distribution: ~40% on pace, ~30% behind,
--     ~20% intervention, ~10% presence concern
--
-- Names: Classic Movie Stars era. Teachers get iconic full names;
-- students get deterministic combinations from a pool.
-- =============================================================================


-- ── Phase 1: Schools, Years, Feature Flags ───────────────────────────────────

INSERT INTO public.schools (name, short_code, address, city, state, cadence_days)
VALUES
  ('Central Christian Academy', 'CCA',  '500 Faith Way',     'Indianapolis', 'IN', 'TUE,THU'),
  ('Adelante',                   'ADEL', '1234 Adelante Ave', 'Indianapolis', 'IN', 'MON,WED')
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO public.academic_years (school_id, label, start_date, end_date, is_current)
SELECT s.school_id, 'FY26', '2025-08-01', '2026-06-30', TRUE
FROM public.schools s
WHERE s.short_code IN ('CCA', 'ADEL')
ON CONFLICT (school_id, label) DO NOTHING;

-- Make sure TILT Pilot also has an FY26 year (it should already, but be safe)
INSERT INTO public.academic_years (school_id, label, start_date, end_date, is_current)
SELECT s.school_id, 'FY26', '2025-08-01', '2026-06-30', TRUE
FROM public.schools s
WHERE s.short_code = 'PILOT'
ON CONFLICT (school_id, label) DO NOTHING;

-- Turn on the PreK subsystem feature flag for CCA only
INSERT INTO public.feature_settings (school_id, feature_key, feature_value, updated_at)
SELECT s.school_id, 'prek_subsystem', 'true', now()
FROM public.schools s
WHERE s.short_code = 'CCA'
ON CONFLICT (school_id, feature_key) DO UPDATE SET feature_value = 'true';


-- ── Phase 2: Big DO block — teachers, students, groups, sequences, progress ─

DO $$
DECLARE
  -- School + year IDs
  v_pilot_id   INT;
  v_cca_id     INT;
  v_adel_id    INT;
  v_year_pilot INT;
  v_year_cca   INT;
  v_year_adel  INT;

  -- Grade IDs
  v_pk INT; v_kg INT; v_g1 INT; v_g2 INT; v_g3 INT;
  v_g4 INT; v_g5 INT; v_g6 INT; v_g7 INT; v_g8 INT;

  -- Name pools (~60 first, ~60 last from classic movie star era)
  first_names TEXT[] := ARRAY[
    'Audrey','Cary','Grace','James','Marilyn','Humphrey','Katharine','Gregory',
    'Ingrid','Clark','Vivien','Spencer','Lauren','Gary','Bette','Errol',
    'Joan','Henry','Rita','Marlon','Elizabeth','Frank','Doris','Paul',
    'Sophia','Charlton','Natalie','John','Judy','Burt','Maureen','Steve',
    'Greta','Lana','Sidney','Ava','Robert','Faye','Yul','Olivia',
    'Sean','Lillian','Ginger','Fred','Anita','Dean','Carole','Mae',
    'Buster','Charlie','Veronica','Hedy','Jean','Loretta','Edward','Tony',
    'Gene','Ralph','Kirk','Deborah'
  ];
  last_names TEXT[] := ARRAY[
    'Hepburn','Grant','Bogart','Peck','Gable','Tracy','Cooper','Flynn',
    'Fonda','Sinatra','Heston','Wayne','Lancaster','McQueen','Poitier','Redford',
    'Brynner','Connery','Newman','Brando','Martin','Keaton','Chaplin','Astaire',
    'Stewart','Douglas','Robinson','Curtis','Kelly','Monroe','Bergman','Leigh',
    'Bacall','Davis','Crawford','Hayworth','Taylor','Day','Loren','Wood',
    'Garland','Garbo','Turner','Gardner','Dunaway','Gish','Rogers','Ekberg',
    'Lombard','West','Lake','Lamarr','Harlow','Young','Bow','Dietrich',
    'Pickford','Swanson','Holden','Lemmon'
  ];

  -- Per-grade school config: array of (school_short, grade_var, teachers, group_count, student_count)
  -- We loop through and process each.

  -- Loop variables
  v_school_id INT;
  v_year_id   INT;
  v_grade_id  INT;
  v_grade_label TEXT;
  v_teacher_id INT;
  v_teacher_idx INT;
  v_student_id INT;
  v_student_idx INT;
  v_group_id INT;
  v_group_idx INT;
  v_sequence_id INT;
  v_lesson_idx INT;
  v_lesson_id INT;
  v_lesson_status sequence_lesson_status;
  v_first_name TEXT;
  v_last_name TEXT;
  v_email TEXT;
  v_perf_band TEXT;
  v_y_chance INT;
  v_a_chance INT;
  v_status lesson_status;
  v_random_pct INT;
  v_date_offset INT;
  v_date DATE;
  v_planned_date DATE;
  v_global_student_idx INT := 0;

  -- Track teacher assignments for groups (per grade per school)
  v_teacher_ids INT[];
  v_teacher_count INT;
  v_assigned_teacher INT;

  -- Mixed-grade tracking
  v_mixed_group_id INT;
  v_mixed_grade_ids INT[];
BEGIN
  -- Look up school IDs
  SELECT school_id INTO v_pilot_id FROM public.schools WHERE short_code = 'PILOT';
  SELECT school_id INTO v_cca_id   FROM public.schools WHERE short_code = 'CCA';
  SELECT school_id INTO v_adel_id  FROM public.schools WHERE short_code = 'ADEL';

  -- Look up academic year IDs (the current FY26 for each school)
  SELECT year_id INTO v_year_pilot FROM public.academic_years WHERE school_id = v_pilot_id AND is_current = TRUE LIMIT 1;
  SELECT year_id INTO v_year_cca   FROM public.academic_years WHERE school_id = v_cca_id   AND is_current = TRUE LIMIT 1;
  SELECT year_id INTO v_year_adel  FROM public.academic_years WHERE school_id = v_adel_id  AND is_current = TRUE LIMIT 1;

  -- Look up grade IDs by name
  SELECT grade_id INTO v_pk FROM public.grade_levels WHERE name = 'PK';
  SELECT grade_id INTO v_kg FROM public.grade_levels WHERE name = 'KG';
  SELECT grade_id INTO v_g1 FROM public.grade_levels WHERE name = 'G1';
  SELECT grade_id INTO v_g2 FROM public.grade_levels WHERE name = 'G2';
  SELECT grade_id INTO v_g3 FROM public.grade_levels WHERE name = 'G3';
  SELECT grade_id INTO v_g4 FROM public.grade_levels WHERE name = 'G4';
  SELECT grade_id INTO v_g5 FROM public.grade_levels WHERE name = 'G5';
  SELECT grade_id INTO v_g6 FROM public.grade_levels WHERE name = 'G6';
  SELECT grade_id INTO v_g7 FROM public.grade_levels WHERE name = 'G7';
  SELECT grade_id INTO v_g8 FROM public.grade_levels WHERE name = 'G8';

  -- ──────────────────────────────────────────────────────────────────────────
  -- TILT PILOT: K-3, 1 teacher per grade, 4 groups of 5, 20 students per grade
  -- ──────────────────────────────────────────────────────────────────────────

  FOR v_grade_id, v_grade_label IN
    SELECT * FROM (VALUES (v_kg, 'KG'), (v_g1, 'G1'), (v_g2, 'G2'), (v_g3, 'G3')) AS t(g, l)
  LOOP
    -- Create the one teacher for this grade (using iconic movie star pairs)
    v_first_name := CASE v_grade_label
      WHEN 'KG' THEN 'Marilyn' WHEN 'G1' THEN 'James'
      WHEN 'G2' THEN 'Grace'   WHEN 'G3' THEN 'Cary' END;
    v_last_name := CASE v_grade_label
      WHEN 'KG' THEN 'Monroe'  WHEN 'G1' THEN 'Stewart'
      WHEN 'G2' THEN 'Kelly'   WHEN 'G3' THEN 'Grant' END;
    v_email := lower(v_first_name || '.' || v_last_name) || '@pilot.test';

    INSERT INTO public.staff (school_id, first_name, last_name, email, role)
    VALUES (v_pilot_id, v_first_name, v_last_name, v_email, 'tutor')
    ON CONFLICT (email) DO NOTHING;

    SELECT staff_id INTO v_teacher_id FROM public.staff WHERE email = v_email;

    -- Create 4 groups of 5 students each for this grade
    FOR v_group_idx IN 1..4 LOOP
      INSERT INTO public.instructional_groups
        (school_id, grade_id, year_id, staff_id, group_name, is_mixed_grade)
      VALUES (
        v_pilot_id, v_grade_id, v_year_pilot, v_teacher_id,
        v_grade_label || ' Group ' || v_group_idx, FALSE
      )
      ON CONFLICT (school_id, year_id, group_name) DO NOTHING;

      SELECT group_id INTO v_group_id
      FROM public.instructional_groups
      WHERE school_id = v_pilot_id AND year_id = v_year_pilot
        AND group_name = v_grade_label || ' Group ' || v_group_idx;

      -- Junction row for the (single) grade
      INSERT INTO public.instructional_group_grades (group_id, grade_id)
      VALUES (v_group_id, v_grade_id)
      ON CONFLICT DO NOTHING;

      -- Create 5 students for this group
      FOR v_student_idx IN 1..5 LOOP
        v_global_student_idx := v_global_student_idx + 1;
        v_first_name := first_names[1 + ((v_global_student_idx * 7)  % 60)];
        v_last_name  := last_names [1 + ((v_global_student_idx * 11) % 60)];

        INSERT INTO public.students
          (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
        VALUES (
          v_pilot_id, v_grade_id, v_first_name, v_last_name,
          'PILOT-' || v_grade_label || '-' || lpad(((v_group_idx - 1) * 5 + v_student_idx)::text, 3, '0'),
          '2025-08-15'
        )
        ON CONFLICT (student_number) DO NOTHING;

        SELECT student_id INTO v_student_id
        FROM public.students
        WHERE student_number =
          'PILOT-' || v_grade_label || '-' || lpad(((v_group_idx - 1) * 5 + v_student_idx)::text, 3, '0');

        INSERT INTO public.group_memberships (group_id, student_id, joined_date, is_active)
        VALUES (v_group_id, v_student_id, '2025-08-20', TRUE)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ──────────────────────────────────────────────────────────────────────────
  -- CCA: PK-G3. KG has 2 teachers, others have 1.
  -- ──────────────────────────────────────────────────────────────────────────

  -- Build the per-grade teacher assignments. Iterate grades in order.
  FOR v_grade_id, v_grade_label, v_teacher_count IN
    SELECT * FROM (VALUES
      (v_pk, 'PK', 1),
      (v_kg, 'KG', 2),
      (v_g1, 'G1', 1),
      (v_g2, 'G2', 1),
      (v_g3, 'G3', 1)
    ) AS t(g, l, c)
  LOOP
    v_teacher_ids := ARRAY[]::INT[];

    -- Create teachers for this grade
    FOR v_teacher_idx IN 1..v_teacher_count LOOP
      -- Pick teacher names per (school + grade + index)
      v_first_name := CASE
        WHEN v_grade_label = 'PK' THEN 'Audrey'
        WHEN v_grade_label = 'KG' AND v_teacher_idx = 1 THEN 'Humphrey'
        WHEN v_grade_label = 'KG' AND v_teacher_idx = 2 THEN 'Ingrid'
        WHEN v_grade_label = 'G1' THEN 'Gregory'
        WHEN v_grade_label = 'G2' THEN 'Vivien'
        WHEN v_grade_label = 'G3' THEN 'Spencer'
      END;
      v_last_name := CASE
        WHEN v_grade_label = 'PK' THEN 'Hepburn'
        WHEN v_grade_label = 'KG' AND v_teacher_idx = 1 THEN 'Bogart'
        WHEN v_grade_label = 'KG' AND v_teacher_idx = 2 THEN 'Bergman'
        WHEN v_grade_label = 'G1' THEN 'Peck'
        WHEN v_grade_label = 'G2' THEN 'Leigh'
        WHEN v_grade_label = 'G3' THEN 'Tracy'
      END;
      v_email := lower(v_first_name || '.' || v_last_name) || '@cca.test';

      INSERT INTO public.staff (school_id, first_name, last_name, email, role)
      VALUES (v_cca_id, v_first_name, v_last_name, v_email, 'tutor')
      ON CONFLICT (email) DO NOTHING;

      SELECT staff_id INTO v_teacher_id FROM public.staff WHERE email = v_email;
      v_teacher_ids := array_append(v_teacher_ids, v_teacher_id);
    END LOOP;

    -- Create 4 groups of 5 students per grade (20 students)
    -- For KG with 2 teachers: groups 1-2 → teacher 1, groups 3-4 → teacher 2
    -- For others: all 4 groups → the single teacher
    FOR v_group_idx IN 1..4 LOOP
      IF v_teacher_count = 1 THEN
        v_assigned_teacher := v_teacher_ids[1];
      ELSE
        v_assigned_teacher := v_teacher_ids[1 + ((v_group_idx - 1) / 2)];
      END IF;

      INSERT INTO public.instructional_groups
        (school_id, grade_id, year_id, staff_id, group_name, is_mixed_grade)
      VALUES (
        v_cca_id, v_grade_id, v_year_cca, v_assigned_teacher,
        v_grade_label || ' Group ' || v_group_idx, FALSE
      )
      ON CONFLICT (school_id, year_id, group_name) DO NOTHING;

      SELECT group_id INTO v_group_id
      FROM public.instructional_groups
      WHERE school_id = v_cca_id AND year_id = v_year_cca
        AND group_name = v_grade_label || ' Group ' || v_group_idx;

      INSERT INTO public.instructional_group_grades (group_id, grade_id)
      VALUES (v_group_id, v_grade_id)
      ON CONFLICT DO NOTHING;

      FOR v_student_idx IN 1..5 LOOP
        v_global_student_idx := v_global_student_idx + 1;
        v_first_name := first_names[1 + ((v_global_student_idx * 7)  % 60)];
        v_last_name  := last_names [1 + ((v_global_student_idx * 11) % 60)];

        INSERT INTO public.students
          (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
        VALUES (
          v_cca_id, v_grade_id, v_first_name, v_last_name,
          'CCA-' || v_grade_label || '-' || lpad(((v_group_idx - 1) * 5 + v_student_idx)::text, 3, '0'),
          '2025-08-15'
        )
        ON CONFLICT (student_number) DO NOTHING;

        SELECT student_id INTO v_student_id
        FROM public.students
        WHERE student_number =
          'CCA-' || v_grade_label || '-' || lpad(((v_group_idx - 1) * 5 + v_student_idx)::text, 3, '0');

        INSERT INTO public.group_memberships (group_id, student_id, joined_date, is_active)
        VALUES (v_group_id, v_student_id, '2025-08-20', TRUE)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ──────────────────────────────────────────────────────────────────────────
  -- ADELANTE: K-G5 single-grade, G6-G8 mixed by skill
  -- ──────────────────────────────────────────────────────────────────────────

  -- Single-grade teachers + groups (KG through G5)
  FOR v_grade_id, v_grade_label IN
    SELECT * FROM (VALUES
      (v_kg, 'KG'), (v_g1, 'G1'), (v_g2, 'G2'),
      (v_g3, 'G3'), (v_g4, 'G4'), (v_g5, 'G5')
    ) AS t(g, l)
  LOOP
    v_first_name := CASE v_grade_label
      WHEN 'KG' THEN 'Katharine' WHEN 'G1' THEN 'Clark'
      WHEN 'G2' THEN 'Bette'     WHEN 'G3' THEN 'Henry'
      WHEN 'G4' THEN 'Joan'      WHEN 'G5' THEN 'Gary' END;
    v_last_name := CASE v_grade_label
      WHEN 'KG' THEN 'Hepburn'   WHEN 'G1' THEN 'Gable'
      WHEN 'G2' THEN 'Davis'     WHEN 'G3' THEN 'Fonda'
      WHEN 'G4' THEN 'Crawford'  WHEN 'G5' THEN 'Cooper' END;
    v_email := lower(v_first_name || '.' || v_last_name) || '@adelante.test';

    INSERT INTO public.staff (school_id, first_name, last_name, email, role)
    VALUES (v_adel_id, v_first_name, v_last_name, v_email, 'tutor')
    ON CONFLICT (email) DO NOTHING;

    SELECT staff_id INTO v_teacher_id FROM public.staff WHERE email = v_email;

    FOR v_group_idx IN 1..4 LOOP
      INSERT INTO public.instructional_groups
        (school_id, grade_id, year_id, staff_id, group_name, is_mixed_grade)
      VALUES (
        v_adel_id, v_grade_id, v_year_adel, v_teacher_id,
        v_grade_label || ' Group ' || v_group_idx, FALSE
      )
      ON CONFLICT (school_id, year_id, group_name) DO NOTHING;

      SELECT group_id INTO v_group_id
      FROM public.instructional_groups
      WHERE school_id = v_adel_id AND year_id = v_year_adel
        AND group_name = v_grade_label || ' Group ' || v_group_idx;

      INSERT INTO public.instructional_group_grades (group_id, grade_id)
      VALUES (v_group_id, v_grade_id)
      ON CONFLICT DO NOTHING;

      FOR v_student_idx IN 1..5 LOOP
        v_global_student_idx := v_global_student_idx + 1;
        v_first_name := first_names[1 + ((v_global_student_idx * 7)  % 60)];
        v_last_name  := last_names [1 + ((v_global_student_idx * 11) % 60)];

        INSERT INTO public.students
          (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
        VALUES (
          v_adel_id, v_grade_id, v_first_name, v_last_name,
          'ADEL-' || v_grade_label || '-' || lpad(((v_group_idx - 1) * 5 + v_student_idx)::text, 3, '0'),
          '2025-08-15'
        )
        ON CONFLICT (student_number) DO NOTHING;

        SELECT student_id INTO v_student_id
        FROM public.students
        WHERE student_number =
          'ADEL-' || v_grade_label || '-' || lpad(((v_group_idx - 1) * 5 + v_student_idx)::text, 3, '0');

        INSERT INTO public.group_memberships (group_id, student_id, joined_date, is_active)
        VALUES (v_group_id, v_student_id, '2025-08-20', TRUE)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Adelante G6-G8 mixed groups: 3 specialist teachers, 12 groups (4 each),
  -- 60 students drawn from G6, G7, G8 (20 per grade) distributed across groups
  v_mixed_grade_ids := ARRAY[v_g6, v_g7, v_g8];

  -- First, create the 60 G6/G7/G8 students (20 per grade) so we can assign
  -- them to mixed groups afterward.
  FOR v_grade_id, v_grade_label IN
    SELECT * FROM (VALUES (v_g6, 'G6'), (v_g7, 'G7'), (v_g8, 'G8')) AS t(g, l)
  LOOP
    FOR v_student_idx IN 1..20 LOOP
      v_global_student_idx := v_global_student_idx + 1;
      v_first_name := first_names[1 + ((v_global_student_idx * 7)  % 60)];
      v_last_name  := last_names [1 + ((v_global_student_idx * 11) % 60)];

      INSERT INTO public.students
        (school_id, grade_id, first_name, last_name, student_number, enrollment_date)
      VALUES (
        v_adel_id, v_grade_id, v_first_name, v_last_name,
        'ADEL-' || v_grade_label || '-' || lpad(v_student_idx::text, 3, '0'),
        '2025-08-15'
      )
      ON CONFLICT (student_number) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Create the 3 specialist teachers and 12 mixed-grade groups (4 per teacher)
  FOR v_teacher_idx IN 1..3 LOOP
    v_first_name := CASE v_teacher_idx
      WHEN 1 THEN 'Errol'  WHEN 2 THEN 'Rita'  WHEN 3 THEN 'Frank' END;
    v_last_name := CASE v_teacher_idx
      WHEN 1 THEN 'Flynn'  WHEN 2 THEN 'Hayworth' WHEN 3 THEN 'Sinatra' END;
    v_email := lower(v_first_name || '.' || v_last_name) || '@adelante.test';

    INSERT INTO public.staff (school_id, first_name, last_name, email, role)
    VALUES (v_adel_id, v_first_name, v_last_name, v_email, 'tutor')
    ON CONFLICT (email) DO NOTHING;

    SELECT staff_id INTO v_teacher_id FROM public.staff WHERE email = v_email;

    FOR v_group_idx IN 1..4 LOOP
      INSERT INTO public.instructional_groups
        (school_id, grade_id, year_id, staff_id, group_name, is_mixed_grade)
      VALUES (
        v_adel_id, v_g6, v_year_adel, v_teacher_id,
        'G6-8 ' || v_first_name || ' Group ' || v_group_idx, TRUE
      )
      ON CONFLICT (school_id, year_id, group_name) DO NOTHING;

      SELECT group_id INTO v_mixed_group_id
      FROM public.instructional_groups
      WHERE school_id = v_adel_id AND year_id = v_year_adel
        AND group_name = 'G6-8 ' || v_first_name || ' Group ' || v_group_idx;

      -- Junction rows for all three grades
      INSERT INTO public.instructional_group_grades (group_id, grade_id)
      VALUES
        (v_mixed_group_id, v_g6),
        (v_mixed_group_id, v_g7),
        (v_mixed_group_id, v_g8)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Distribute the 60 G6-G8 students across the 12 mixed groups (5 each).
  -- Use a simple round-robin: student #N → group #(N % 12)
  WITH numbered AS (
    SELECT s.student_id,
           ROW_NUMBER() OVER (ORDER BY s.student_number) - 1 AS idx
    FROM public.students s
    WHERE s.school_id = v_adel_id
      AND s.grade_id IN (v_g6, v_g7, v_g8)
  ),
  mixed_groups AS (
    SELECT g.group_id,
           ROW_NUMBER() OVER (ORDER BY g.group_name) - 1 AS idx
    FROM public.instructional_groups g
    WHERE g.school_id = v_adel_id AND g.is_mixed_grade = TRUE
  )
  INSERT INTO public.group_memberships (group_id, student_id, joined_date, is_active)
  SELECT mg.group_id, n.student_id, '2025-08-20', TRUE
  FROM numbered n
  JOIN mixed_groups mg ON mg.idx = n.idx % 12
  ON CONFLICT DO NOTHING;


  -- ──────────────────────────────────────────────────────────────────────────
  -- INSTRUCTIONAL SEQUENCES + LESSON PROGRESS
  -- For every group across all 3 schools, build an active sequence (L1-L8)
  -- with the first 5 lessons marked completed and lesson 6 'current'. Then
  -- generate lesson_progress rows for each student in the group covering
  -- those 5 lessons with a performance pattern based on the student's index.
  --
  -- Idempotency: if a group already has any active sequence, we leave it
  -- alone — including its lessons and any associated lesson_progress.
  -- This makes the seed purely additive and safe to re-run after manual
  -- testing has happened.
  -- ──────────────────────────────────────────────────────────────────────────

  FOR v_group_id, v_school_id, v_year_id, v_teacher_id IN
    SELECT g.group_id, g.school_id, g.year_id, g.staff_id
    FROM public.instructional_groups g
    WHERE g.school_id IN (v_pilot_id, v_cca_id, v_adel_id)
    ORDER BY g.group_id
  LOOP
    SELECT sequence_id INTO v_sequence_id
    FROM public.instructional_sequences
    WHERE group_id = v_group_id AND status = 'active';

    -- Skip groups that already have an active sequence — leave them alone
    -- to preserve any manually-built sequences and their progress data.
    IF v_sequence_id IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Create the sequence
    INSERT INTO public.instructional_sequences
      (group_id, year_id, name, start_date, end_date, status, sort_order)
    VALUES (
      v_group_id, v_year_id, 'Sequence 1',
      (CURRENT_DATE - INTERVAL '35 days')::date,
      (CURRENT_DATE + INTERVAL '21 days')::date,
      'active', 1
    )
    RETURNING sequence_id INTO v_sequence_id;

    -- Add the 8 lesson rows: lessons L1-L8.
    -- L1-L5 completed, L6 current, L7-L8 upcoming.
    FOR v_lesson_idx IN 1..8 LOOP
      SELECT lesson_id INTO v_lesson_id
      FROM public.ufli_lessons
      WHERE lesson_number = v_lesson_idx;

      v_lesson_status := CASE
        WHEN v_lesson_idx <= 5 THEN 'completed'::sequence_lesson_status
        WHEN v_lesson_idx = 6 THEN 'current'::sequence_lesson_status
        ELSE 'upcoming'::sequence_lesson_status
      END;

      v_planned_date := (CURRENT_DATE - INTERVAL '35 days' + (v_lesson_idx - 1) * INTERVAL '4 days')::date;

      INSERT INTO public.instructional_sequence_lessons
        (sequence_id, lesson_id, sort_order, planned_date, status, completed_at)
      VALUES (
        v_sequence_id, v_lesson_id, v_lesson_idx - 1, v_planned_date,
        v_lesson_status,
        CASE WHEN v_lesson_status = 'completed'
             THEN now() - INTERVAL '5 days' * (8 - v_lesson_idx)
             ELSE NULL END
      );
    END LOOP;

    -- Generate lesson_progress for each student in the group, covering
    -- the 5 completed lessons (L1-L5).
    FOR v_student_id IN
      SELECT gm.student_id
      FROM public.group_memberships gm
      WHERE gm.group_id = v_group_id AND gm.is_active = TRUE
    LOOP
      -- Determine performance band by student_id modulo 10
      -- 0   → presence concern (mostly absent)
      -- 1,2 → intervention (low pass rate)
      -- 3,4,5 → behind (medium pass rate)
      -- 6-9 → on pace (high pass rate)
      v_perf_band := CASE v_student_id % 10
        WHEN 0 THEN 'presence'
        WHEN 1 THEN 'intervention' WHEN 2 THEN 'intervention'
        WHEN 3 THEN 'behind' WHEN 4 THEN 'behind' WHEN 5 THEN 'behind'
        ELSE 'on_pace'
      END;

      -- For each of the first 5 lessons, generate a row
      FOR v_lesson_idx IN 1..5 LOOP
        SELECT lesson_id INTO v_lesson_id
        FROM public.ufli_lessons
        WHERE lesson_number = v_lesson_idx;

        v_date_offset := 35 - (v_lesson_idx * 4);  -- L1 = 31 days ago, L5 = 15 days ago
        v_date := (CURRENT_DATE - v_date_offset * INTERVAL '1 day')::date;

        -- Deterministic "random" via student_id + lesson_idx hash
        v_random_pct := ((v_student_id * 13 + v_lesson_idx * 17) % 100);

        v_status := CASE v_perf_band
          WHEN 'presence'     THEN
            CASE WHEN v_random_pct < 60 THEN 'A'::lesson_status
                 WHEN v_random_pct < 90 THEN 'Y'::lesson_status
                 ELSE 'N'::lesson_status END
          WHEN 'intervention' THEN
            CASE WHEN v_random_pct < 30 THEN 'Y'::lesson_status
                 WHEN v_random_pct < 90 THEN 'N'::lesson_status
                 ELSE 'A'::lesson_status END
          WHEN 'behind'       THEN
            CASE WHEN v_random_pct < 60 THEN 'Y'::lesson_status
                 WHEN v_random_pct < 90 THEN 'N'::lesson_status
                 ELSE 'A'::lesson_status END
          ELSE  -- on_pace
            CASE WHEN v_random_pct < 85 THEN 'Y'::lesson_status
                 WHEN v_random_pct < 95 THEN 'N'::lesson_status
                 ELSE 'A'::lesson_status END
        END;

        INSERT INTO public.lesson_progress
          (student_id, group_id, lesson_id, year_id, status, date_recorded, recorded_by, source)
        VALUES (
          v_student_id, v_group_id, v_lesson_id, v_year_id,
          v_status, v_date, v_teacher_id, 'import'
        )
        ON CONFLICT (student_id, lesson_id, year_id, date_recorded) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Test data seed complete: % students inserted (cumulative)', v_global_student_idx;
END $$;
