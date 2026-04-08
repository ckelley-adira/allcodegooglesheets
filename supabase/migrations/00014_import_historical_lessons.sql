-- =============================================================================
-- Adira Reads: Historical Lesson Progress Import Transform (Phase IM.5)
-- =============================================================================
-- import_historical_lessons(p_run_id text, p_school_code text)
--
-- Reads staging_lesson_progress rows with transform_status='pending' for the
-- given run+school and writes them into the live lesson_progress table with
-- source='import'. This is the final transform in the import pipeline —
-- runs after IM.2 (staff + students) and after Christina manually creates
-- the groups via /dashboard/groups.
--
-- Dependency ordering (enforced by per-row validation, not upfront):
--   1. Staff must exist (not strictly required for lesson_progress inserts
--      since recorded_by is nullable, but groups reference staff)
--   2. Students must exist with matching names (upserted by import_students)
--   3. Groups must exist with matching group_name values (Christina creates
--      these by hand through /dashboard/groups between IM.2 and IM.5)
--   4. academic_years row with is_current=TRUE must exist for the school
--      (migration 00011 already ensures this for CCA/GPA/APA)
--
-- Matching rules:
--
--   student_name → student_id
--     Same as import_initial_assessments: split via split_person_name()
--     then normalized-exact lowercased match on (school_id, first, last,
--     enrollment_status='active'). Ambiguous matches (twins/homonyms)
--     fail with a clear error.
--
--   group_label → group_id
--     Exact match on instructional_groups.group_name (case-sensitive)
--     scoped by school_id. Inactive groups are eligible — historical data
--     often references groups that have since been retired. Ambiguous
--     matches fail (two active groups with the same name); Christina
--     resolves by renaming one of them in the UI.
--
--   lesson_number → lesson_id
--     Direct join against ufli_lessons.lesson_number. Valid range 1..128.
--
--   date_recorded_raw → date_recorded
--     ISO (YYYY-MM-DD) first, then MM/DD/YYYY fallback. Any other format
--     fails the row. The resolved date must fall within the school's
--     current academic_year [start_date, end_date] — anything outside
--     FY26 is rejected per Q4 scope.
--
--   status → lesson_status
--     Must be one of 'Y', 'N', 'A' (case-insensitive). Anything else fails.
--
-- Conflict handling:
--
--   lesson_progress has a unique constraint on
--   (student_id, lesson_id, year_id, date_recorded). A conflict means the
--   same student/lesson/year/date already has a row from some other
--   source (wizard, earlier import, tutor session). The transform
--   UPDATES the existing row's status + source so re-runs on corrected
--   staging data are idempotent and the last writer wins.
--
-- Counters:
--
--   imported  — rows that did not previously exist
--   updated   — rows that already existed and were overwritten
--   errors    — rows that failed validation or matching
--   skipped   — currently unused (reserved for future "already identical" logic)
--
-- Summary return shape matches the other import transforms so the caller
-- experience is uniform across the four import phases.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.import_historical_lessons(
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
  v_year_start date;
  v_year_end date;

  -- Per-row working state
  v_row record;
  v_first_name text;
  v_last_name text;
  v_match_count int;
  v_student_id int;
  v_group_id int;
  v_lesson_id int;
  v_date_recorded date;
  v_status_normalized text;
  v_was_existing boolean;

  -- Counters
  v_imp int := 0;
  v_upd int := 0;
  v_skp int := 0;
  v_err int := 0;
  v_first_errors text[] := ARRAY[]::text[];
  v_error_msg text;
BEGIN
  -- ── Resolve school + current academic year window ───────────────────
  SELECT school_id INTO v_school_id
  FROM public.schools
  WHERE short_code = p_school_code;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'import_historical_lessons: no school with short_code = %', p_school_code;
  END IF;

  SELECT year_id, start_date, end_date
  INTO v_year_id, v_year_start, v_year_end
  FROM public.academic_years
  WHERE school_id = v_school_id AND is_current = TRUE
  ORDER BY label DESC
  LIMIT 1;

  IF v_year_id IS NULL THEN
    RAISE EXCEPTION 'import_historical_lessons: no current academic year for %', p_school_code;
  END IF;

  -- ── Iterate staging rows ─────────────────────────────────────────────
  FOR v_row IN
    SELECT *
    FROM public.staging_lesson_progress
    WHERE import_run_id = p_run_id
      AND school_code = p_school_code
      AND transform_status = 'pending'
    ORDER BY id
  LOOP
    BEGIN
      -- ── Validate + normalize status ────────────────────────────────
      v_status_normalized := upper(trim(COALESCE(v_row.status, '')));
      IF v_status_normalized NOT IN ('Y', 'N', 'A') THEN
        v_error_msg := 'invalid status (must be Y/N/A): ' || COALESCE(v_row.status, '<null>');
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (COALESCE(v_row.student_name, '<no name>') || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      -- ── Parse + validate date ──────────────────────────────────────
      v_date_recorded := NULL;
      IF v_row.date_recorded_raw IS NULL OR trim(v_row.date_recorded_raw) = '' THEN
        v_error_msg := 'missing date_recorded';
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      BEGIN
        v_date_recorded := v_row.date_recorded_raw::date;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          v_date_recorded := to_date(v_row.date_recorded_raw, 'MM/DD/YYYY');
        EXCEPTION WHEN OTHERS THEN
          v_date_recorded := NULL;
        END;
      END;

      IF v_date_recorded IS NULL THEN
        v_error_msg := 'could not parse date_recorded: ' || v_row.date_recorded_raw;
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      -- Scope check: row must fall within the current academic year
      IF v_date_recorded < v_year_start OR v_date_recorded > v_year_end THEN
        v_error_msg := 'date outside current year (' || v_year_start || '..' || v_year_end
          || '): ' || v_date_recorded;
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      -- ── Validate lesson_number ─────────────────────────────────────
      IF v_row.lesson_number IS NULL OR v_row.lesson_number < 1 OR v_row.lesson_number > 128 THEN
        v_error_msg := 'lesson_number out of range (1-128): ' || COALESCE(v_row.lesson_number::text, '<null>');
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      -- Resolve lesson_id
      SELECT lesson_id INTO v_lesson_id
      FROM public.ufli_lessons
      WHERE lesson_number = v_row.lesson_number;

      IF v_lesson_id IS NULL THEN
        v_error_msg := 'no ufli_lessons row for lesson_number = ' || v_row.lesson_number;
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        CONTINUE;
      END IF;

      -- ── Match student ──────────────────────────────────────────────
      SELECT sn.first_name, sn.last_name
      INTO v_first_name, v_last_name
      FROM public.split_person_name(v_row.student_name) sn;

      IF v_first_name IS NULL OR v_first_name = '' THEN
        v_error_msg := 'could not parse student_name';
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (COALESCE(v_row.student_name, '<no name>') || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      SELECT COUNT(*), MIN(s.student_id)
      INTO v_match_count, v_student_id
      FROM public.students s
      WHERE s.school_id = v_school_id
        AND s.enrollment_status = 'active'
        AND lower(trim(s.first_name)) = lower(trim(v_first_name))
        AND lower(trim(s.last_name))  = lower(trim(COALESCE(NULLIF(v_last_name, ''), v_first_name)));

      IF v_match_count = 0 THEN
        v_error_msg := 'no matching active student: ' || v_row.student_name;
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      ELSIF v_match_count > 1 THEN
        v_error_msg := 'ambiguous student match (' || v_match_count || '): ' || v_row.student_name;
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      -- ── Match group ────────────────────────────────────────────────
      IF v_row.group_label IS NULL OR trim(v_row.group_label) = '' THEN
        v_error_msg := 'missing group_label';
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      SELECT COUNT(*), MIN(g.group_id)
      INTO v_match_count, v_group_id
      FROM public.instructional_groups g
      WHERE g.school_id = v_school_id
        AND g.group_name = v_row.group_label;

      IF v_match_count = 0 THEN
        v_error_msg := 'no matching group (create it via /dashboard/groups first): '
          || v_row.group_label;
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      ELSIF v_match_count > 1 THEN
        v_error_msg := 'ambiguous group match (' || v_match_count
          || ' groups with same name): ' || v_row.group_label;
        UPDATE public.staging_lesson_progress
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      -- ── Was this row previously present? (counter bookkeeping) ────
      SELECT COUNT(*) > 0 INTO v_was_existing
      FROM public.lesson_progress
      WHERE student_id = v_student_id
        AND lesson_id = v_lesson_id
        AND year_id = v_year_id
        AND date_recorded = v_date_recorded;

      -- ── Upsert into lesson_progress ────────────────────────────────
      INSERT INTO public.lesson_progress (
        student_id, group_id, lesson_id, year_id, status,
        date_recorded, recorded_by, source
      ) VALUES (
        v_student_id, v_group_id, v_lesson_id, v_year_id,
        v_status_normalized::public.lesson_status,
        v_date_recorded, NULL, 'import'
      )
      ON CONFLICT (student_id, lesson_id, year_id, date_recorded) DO UPDATE SET
        status = EXCLUDED.status,
        group_id = EXCLUDED.group_id,
        source = 'import';

      IF v_was_existing THEN
        v_upd := v_upd + 1;
      ELSE
        v_imp := v_imp + 1;
      END IF;

      UPDATE public.staging_lesson_progress
      SET transform_status = 'imported', transform_error = NULL
      WHERE id = v_row.id;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      UPDATE public.staging_lesson_progress
      SET transform_status = 'error', transform_error = v_error_msg
      WHERE id = v_row.id;
      v_err := v_err + 1;
      IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
        v_first_errors := v_first_errors
          || (COALESCE(v_row.student_name, v_row.group_label, '<row>')
              || ': ' || v_error_msg);
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

COMMENT ON FUNCTION public.import_historical_lessons(text, text) IS
  'Consumes staging_lesson_progress rows for one (run_id, school_code) '
  'pair. Matches student_name + group_label against live rows, validates '
  'the date falls within the current school year, and upserts into '
  'lesson_progress with source=''import''. Requires groups to already '
  'exist in /dashboard/groups (Option A per import-design.md Q3). '
  'APA does NOT run this function \u2014 APA historical data is not imported.';
