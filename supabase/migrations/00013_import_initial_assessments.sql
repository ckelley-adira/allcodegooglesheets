-- =============================================================================
-- Adira Reads: Initial Assessment Import Transform (Phase IM.4)
-- =============================================================================
-- import_initial_assessments(p_run_id text, p_school_code text)
--
-- Reads staging_initial_assessments rows with transform_status='pending' for
-- the given run+school and writes them into three live tables in one pass:
--
--   1. initial_assessments  (one header row per student, snapshot_type='baseline')
--   2. initial_assessment_lessons (one row per Y/N lesson, review lessons skipped)
--   3. lesson_progress      (synthetic rows with source='assessment' so the
--                            Big Four high-water-mark logic picks up the
--                            baseline mastery — matches the live wizard flow)
--
-- Student matching is normalized-exact: split the staging row's
-- student_name into first/last via split_person_name(), then match against
-- live students rows where lower(trim(first_name))+lower(trim(last_name))
-- matches AND school_id matches AND enrollment_status='active'. Ambiguous
-- matches (twins, homonyms) fail with a clear error; Christina can
-- disambiguate by adding middle names or student_number to the source data.
--
-- Percentage math MATCHES the live wizard exactly (per lib/assessment/
-- scoring.ts), so imported baselines and wizard-captured baselines produce
-- identical foundational/kg/g1/g2/overall numbers for the same input:
--
--   For each grade band:
--     tested  = count of non-review lessons in band that are Y or N
--     mastered = count of those that are Y
--     pct     = (mastered / tested) * 100  (if tested > 0, else NULL)
--
--   Band ranges (matching GRADE_SKILL_CONFIG in the wizard):
--     foundational : L1..L34 minus REVIEW_LESSONS
--     kg           : L1..L68 minus REVIEW_LESSONS minus {38, 60, 61}
--                    (only computed if student is in KG; else stored as 0)
--     first_grade  : L35..L110 minus REVIEW_LESSONS
--     second_grade : L38..L127 minus REVIEW_LESSONS
--     overall      : ALL non-review lessons that are Y or N
--
--   REVIEW_LESSONS = {35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,
--                     97,102,104,105,106,128}
--
-- Re-runnability: if a baseline already exists for (student_id, year_id),
-- we UPDATE the header in place and REPLACE all downstream rows (lesson
-- rows + lesson_progress assessment-sourced rows for that same date).
-- Safe to re-run against corrected staging data.
--
-- APA note: this function runs standalone. Christina creates APA's staff,
-- students, and groups by hand via the UI; then uploads the initial
-- assessment CSV and runs this transform with school_code='APA'. Teacher
-- and student imports are not required for APA.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.import_initial_assessments(
  p_run_id text,
  p_school_code text
)
RETURNS TABLE (
  imported int,
  updated int,
  skipped int,
  errors int,
  first_errors text[]
)
LANGUAGE plpgsql AS $$
DECLARE
  -- Scope
  v_school_id int;
  v_year_id int;

  -- Per-row working state
  v_row record;
  v_first_name text;
  v_last_name text;
  v_match_count int;
  v_student_id int;
  v_student_grade text;
  v_assessment_date date;
  v_existing_id bigint;
  v_was_existing boolean;
  v_assessment_id bigint;

  -- Counters
  v_imp int := 0;
  v_upd int := 0;
  v_skp int := 0;
  v_err int := 0;
  v_first_errors text[] := ARRAY[]::text[];
  v_error_msg text;

  -- Per-row iteration over the 128 wide lesson columns
  v_row_jsonb jsonb;
  v_key text;
  v_status text;
  v_lesson_num int;

  -- Per-row accumulators for the five bands (matching wizard scoring)
  v_found_tested   int; v_found_mastered   int;
  v_kg_tested      int; v_kg_mastered      int;
  v_g1_tested      int; v_g1_mastered      int;
  v_g2_tested      int; v_g2_mastered      int;
  v_overall_tested int; v_overall_mastered int;

  -- Percentages (NULL if denominator is zero)
  v_found_pct numeric;
  v_kg_pct numeric;
  v_g1_pct numeric;
  v_g2_pct numeric;
  v_overall_pct numeric;

  -- Collected Y/N lesson pairs for bulk insert after the loop
  v_lesson_results jsonb;

  -- Constants
  v_review_lessons CONSTANT int[] := ARRAY[
    35, 36, 37, 39, 40, 41, 49, 53, 57, 59, 62,
    71, 76, 79, 83, 88, 92, 97, 102, 104, 105, 106, 128
  ];
BEGIN
  -- ── Resolve school + current academic year ───────────────────────────
  SELECT school_id INTO v_school_id
  FROM public.schools
  WHERE short_code = p_school_code;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'import_initial_assessments: no school with short_code = %', p_school_code;
  END IF;

  SELECT year_id INTO v_year_id
  FROM public.academic_years
  WHERE school_id = v_school_id AND is_current = TRUE
  ORDER BY label DESC
  LIMIT 1;

  IF v_year_id IS NULL THEN
    RAISE EXCEPTION 'import_initial_assessments: no current academic year for %', p_school_code;
  END IF;

  -- ── Iterate staging rows ─────────────────────────────────────────────
  FOR v_row IN
    SELECT *
    FROM public.staging_initial_assessments
    WHERE import_run_id = p_run_id
      AND school_code = p_school_code
      AND transform_status = 'pending'
    ORDER BY id
  LOOP
    BEGIN
      -- ── Parse student name ─────────────────────────────────────────
      SELECT sn.first_name, sn.last_name
      INTO v_first_name, v_last_name
      FROM public.split_person_name(v_row.student_name) sn;

      IF v_first_name IS NULL OR v_first_name = '' THEN
        v_error_msg := 'could not parse student_name';
        UPDATE public.staging_initial_assessments
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (COALESCE(v_row.student_name, '<no name>') || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      -- ── Match student (normalized, school-scoped) ──────────────────
      SELECT COUNT(*), MIN(s.student_id)
      INTO v_match_count, v_student_id
      FROM public.students s
      WHERE s.school_id = v_school_id
        AND s.enrollment_status = 'active'
        AND lower(trim(s.first_name)) = lower(trim(v_first_name))
        AND lower(trim(s.last_name))  = lower(trim(COALESCE(NULLIF(v_last_name, ''), v_first_name)));

      IF v_match_count = 0 THEN
        v_error_msg := 'no matching active student: ' || v_row.student_name;
        UPDATE public.staging_initial_assessments
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      ELSIF v_match_count > 1 THEN
        v_error_msg := 'ambiguous student match (' || v_match_count || ' students): ' || v_row.student_name;
        UPDATE public.staging_initial_assessments
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      -- ── Look up student grade (for the KG-only kg_pct check) ──────
      SELECT gl.name INTO v_student_grade
      FROM public.students s
      JOIN public.grade_levels gl ON gl.grade_id = s.grade_id
      WHERE s.student_id = v_student_id;

      -- ── Parse assessment date ──────────────────────────────────────
      BEGIN
        v_assessment_date := v_row.assessment_date::date;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          v_assessment_date := to_date(v_row.assessment_date, 'MM/DD/YYYY');
        EXCEPTION WHEN OTHERS THEN
          v_error_msg := 'could not parse assessment_date: ' || COALESCE(v_row.assessment_date, '<null>');
          UPDATE public.staging_initial_assessments
          SET transform_status = 'error', transform_error = v_error_msg
          WHERE id = v_row.id;
          v_err := v_err + 1;
          IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
            v_first_errors := v_first_errors || v_error_msg;
          END IF;
          CONTINUE;
        END;
      END;

      -- ── Reset per-row counters ─────────────────────────────────────
      v_found_tested := 0;   v_found_mastered := 0;
      v_kg_tested := 0;      v_kg_mastered := 0;
      v_g1_tested := 0;      v_g1_mastered := 0;
      v_g2_tested := 0;      v_g2_mastered := 0;
      v_overall_tested := 0; v_overall_mastered := 0;
      v_lesson_results := '[]'::jsonb;

      -- ── Iterate the 128 lesson columns via jsonb ───────────────────
      -- to_jsonb(v_row) serializes the record to a jsonb object with
      -- keys matching the column names. We filter to 'l<N>' keys, cast
      -- N to int, and accumulate counters per band.
      v_row_jsonb := to_jsonb(v_row);

      FOR v_key, v_status IN
        SELECT key, value
        FROM jsonb_each_text(v_row_jsonb)
        WHERE key ~ '^l[0-9]+$'
      LOOP
        v_lesson_num := substring(v_key FROM 2)::int;
        IF v_lesson_num < 1 OR v_lesson_num > 128 THEN
          CONTINUE;
        END IF;

        -- Normalize status: empty, NULL, or anything other than Y/N is unscored
        v_status := upper(trim(COALESCE(v_status, '')));
        IF v_status NOT IN ('Y', 'N') THEN
          CONTINUE;
        END IF;

        -- Skip review lessons from scoring AND from inserts
        IF v_lesson_num = ANY(v_review_lessons) THEN
          CONTINUE;
        END IF;

        -- Collect for bulk insert
        v_lesson_results := v_lesson_results
          || jsonb_build_object('lesson_num', v_lesson_num, 'status', v_status);

        -- Overall (all non-review Y/N lessons)
        v_overall_tested := v_overall_tested + 1;
        IF v_status = 'Y' THEN
          v_overall_mastered := v_overall_mastered + 1;
        END IF;

        -- Foundational: L1..L34 (reviews already filtered above)
        IF v_lesson_num BETWEEN 1 AND 34 THEN
          v_found_tested := v_found_tested + 1;
          IF v_status = 'Y' THEN v_found_mastered := v_found_mastered + 1; END IF;
        END IF;

        -- KG: L1..L68 minus {38, 60, 61}
        IF v_lesson_num BETWEEN 1 AND 68 AND v_lesson_num NOT IN (38, 60, 61) THEN
          v_kg_tested := v_kg_tested + 1;
          IF v_status = 'Y' THEN v_kg_mastered := v_kg_mastered + 1; END IF;
        END IF;

        -- G1: L35..L110
        IF v_lesson_num BETWEEN 35 AND 110 THEN
          v_g1_tested := v_g1_tested + 1;
          IF v_status = 'Y' THEN v_g1_mastered := v_g1_mastered + 1; END IF;
        END IF;

        -- G2: L38..L127
        IF v_lesson_num BETWEEN 38 AND 127 THEN
          v_g2_tested := v_g2_tested + 1;
          IF v_status = 'Y' THEN v_g2_mastered := v_g2_mastered + 1; END IF;
        END IF;
      END LOOP;

      -- ── Compute percentages ────────────────────────────────────────
      v_found_pct := CASE WHEN v_found_tested > 0
        THEN round((v_found_mastered::numeric / v_found_tested) * 100, 2)
        ELSE NULL END;

      -- kg_pct is only meaningful for KG students. Matches wizard behavior:
      -- non-KG students get 0 stored (not NULL) so the column is fillable.
      v_kg_pct := CASE
        WHEN v_student_grade = 'KG' AND v_kg_tested > 0
          THEN round((v_kg_mastered::numeric / v_kg_tested) * 100, 2)
        WHEN v_student_grade = 'KG' AND v_kg_tested = 0
          THEN NULL
        ELSE 0
      END;

      v_g1_pct := CASE WHEN v_g1_tested > 0
        THEN round((v_g1_mastered::numeric / v_g1_tested) * 100, 2)
        ELSE NULL END;

      v_g2_pct := CASE WHEN v_g2_tested > 0
        THEN round((v_g2_mastered::numeric / v_g2_tested) * 100, 2)
        ELSE NULL END;

      v_overall_pct := CASE WHEN v_overall_tested > 0
        THEN round((v_overall_mastered::numeric / v_overall_tested) * 100, 2)
        ELSE NULL END;

      -- ── Check for existing baseline BEFORE the upsert ──────────────
      -- This captures the pre-upsert state so we can distinguish
      -- inserts from updates in the summary counters.
      SELECT assessment_id INTO v_existing_id
      FROM public.initial_assessments
      WHERE student_id = v_student_id
        AND year_id = v_year_id
        AND snapshot_type = 'baseline';

      v_was_existing := v_existing_id IS NOT NULL;

      -- ── UPSERT the header row ──────────────────────────────────────
      INSERT INTO public.initial_assessments (
        student_id, year_id, snapshot_type, assessment_date, scorer_id,
        is_kindergarten_eoy,
        foundational_pct, kg_pct, first_grade_pct, second_grade_pct, overall_pct,
        notes
      ) VALUES (
        v_student_id, v_year_id, 'baseline', v_assessment_date, NULL,
        FALSE,
        v_found_pct, v_kg_pct, v_g1_pct, v_g2_pct, v_overall_pct,
        'Imported via import_initial_assessments(' || p_run_id || ')'
      )
      ON CONFLICT (student_id, year_id, snapshot_type) DO UPDATE SET
        assessment_date = EXCLUDED.assessment_date,
        foundational_pct = EXCLUDED.foundational_pct,
        kg_pct = EXCLUDED.kg_pct,
        first_grade_pct = EXCLUDED.first_grade_pct,
        second_grade_pct = EXCLUDED.second_grade_pct,
        overall_pct = EXCLUDED.overall_pct,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING assessment_id INTO v_assessment_id;

      -- ── Replace all downstream rows for this assessment ───────────
      -- Clear any prior lesson rows (re-run safe)
      DELETE FROM public.initial_assessment_lessons
      WHERE assessment_id = v_assessment_id;

      -- Insert fresh lesson rows for every Y/N we collected
      INSERT INTO public.initial_assessment_lessons (assessment_id, lesson_id, status)
      SELECT
        v_assessment_id,
        ul.lesson_id,
        (elem->>'status')::public.lesson_status
      FROM jsonb_array_elements(v_lesson_results) elem
      JOIN public.ufli_lessons ul
        ON ul.lesson_number = (elem->>'lesson_num')::int;

      -- Clear prior assessment-sourced lesson_progress for this student
      -- scoped to the same assessment_date. Preserves lesson_progress
      -- rows from other dates (wizard-submitted baselines, sessions).
      DELETE FROM public.lesson_progress
      WHERE student_id = v_student_id
        AND year_id = v_year_id
        AND source = 'assessment'
        AND date_recorded = v_assessment_date;

      -- Seed lesson_progress from the Y/N rows (group_id=NULL per 00007).
      -- This is what makes the Big Four HWM logic pick up the baseline.
      INSERT INTO public.lesson_progress (
        student_id, group_id, lesson_id, year_id, status,
        date_recorded, recorded_by, source
      )
      SELECT
        v_student_id, NULL, ul.lesson_id, v_year_id,
        (elem->>'status')::public.lesson_status,
        v_assessment_date, NULL, 'assessment'
      FROM jsonb_array_elements(v_lesson_results) elem
      JOIN public.ufli_lessons ul
        ON ul.lesson_number = (elem->>'lesson_num')::int
      ON CONFLICT (student_id, lesson_id, year_id, date_recorded) DO UPDATE SET
        status = EXCLUDED.status,
        source = EXCLUDED.source;

      -- Count insert vs update based on pre-upsert existence check
      IF v_was_existing THEN
        v_upd := v_upd + 1;
      ELSE
        v_imp := v_imp + 1;
      END IF;

      UPDATE public.staging_initial_assessments
      SET transform_status = 'imported', transform_error = NULL
      WHERE id = v_row.id;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      UPDATE public.staging_initial_assessments
      SET transform_status = 'error', transform_error = v_error_msg
      WHERE id = v_row.id;
      v_err := v_err + 1;
      IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
        v_first_errors := v_first_errors
          || (COALESCE(v_row.student_name, '<no name>') || ': ' || v_error_msg);
      END IF;
    END;
  END LOOP;

  imported := v_imp;
  updated := v_upd;
  skipped := v_skp;
  errors := v_err;
  first_errors := v_first_errors;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.import_initial_assessments(text, text) IS
  'Consumes staging_initial_assessments rows for one (run_id, school_code) '
  'pair. Parses L1..L128 columns, computes foundational/kg/g1/g2/overall '
  'percentages matching the live wizard, upserts initial_assessments + '
  'initial_assessment_lessons, and seeds lesson_progress with '
  'source=''assessment''. Re-runnable: existing baselines are updated in '
  'place and downstream rows are replaced. APA runs this standalone; '
  'CCA and GPA run it after import_teachers + import_students.';
