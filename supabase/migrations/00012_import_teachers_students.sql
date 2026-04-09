-- =============================================================================
-- Adira Reads: Teacher + Student Import Transforms (Phase IM.2)
-- =============================================================================
-- Two PL/pgSQL transform functions that consume staged rows and write to the
-- live staff + students tables. Plus three small helpers:
--
--   normalize_grade_name(text) → text
--     "KG", "K", "Kindergarten" → 'KG'
--     "3", "G3", "3rd", "Grade 3", "Third" → 'G3'
--     etc. through G8. Returns NULL for unrecognized values.
--
--   normalize_staff_role(text) → staff_role
--     Maps free-text roles ("Teacher", "Principal", "Coach") to the live
--     staff_role enum. Defaults to 'tutor' for anything unrecognized or null.
--
--   split_person_name(text) → (first_name, last_name)
--     Handles "Last, First" and "First [Middle] Last" formats. Everything
--     before the last space is first_name; last word is last_name. Comma
--     format takes precedence.
--
-- The transforms themselves:
--
--   import_teachers(p_run_id, p_school_code)
--     Reads staging_teachers rows with transform_status='pending',
--     validates email + teacher_name, upserts staff rows keyed on email.
--     Marks each staging row 'imported' / 'error' in place so you can
--     re-run against pending rows only.
--
--   import_students(p_run_id, p_school_code)
--     Reads staging_students rows, normalizes grade_raw → grade_levels.name,
--     parses enrollment_date (falls back to the school's current year start),
--     upserts students keyed on student_number.
--
-- Both functions return a single-row TABLE (imported, updated, skipped,
-- errors, first_errors). first_errors is capped at 10 entries for a quick
-- diagnosis; the full error text for each failed row lives on the
-- staging_* row itself in transform_error.
--
-- Neither function ever raises on per-row errors — one bad row doesn't kill
-- the batch. They only raise on setup errors (bad school_code, etc.).
-- =============================================================================


-- ── Helper: normalize_grade_name ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_grade_name(p_raw text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(trim(COALESCE(p_raw, '')))
    WHEN 'KG' THEN 'KG'
    WHEN 'K' THEN 'KG'
    WHEN 'KINDERGARTEN' THEN 'KG'
    WHEN '0' THEN 'KG'
    WHEN '1' THEN 'G1'
    WHEN 'G1' THEN 'G1'
    WHEN '1ST' THEN 'G1'
    WHEN 'GRADE 1' THEN 'G1'
    WHEN 'FIRST' THEN 'G1'
    WHEN '2' THEN 'G2'
    WHEN 'G2' THEN 'G2'
    WHEN '2ND' THEN 'G2'
    WHEN 'GRADE 2' THEN 'G2'
    WHEN 'SECOND' THEN 'G2'
    WHEN '3' THEN 'G3'
    WHEN 'G3' THEN 'G3'
    WHEN '3RD' THEN 'G3'
    WHEN 'GRADE 3' THEN 'G3'
    WHEN 'THIRD' THEN 'G3'
    WHEN '4' THEN 'G4'
    WHEN 'G4' THEN 'G4'
    WHEN '4TH' THEN 'G4'
    WHEN 'GRADE 4' THEN 'G4'
    WHEN 'FOURTH' THEN 'G4'
    WHEN '5' THEN 'G5'
    WHEN 'G5' THEN 'G5'
    WHEN '5TH' THEN 'G5'
    WHEN 'GRADE 5' THEN 'G5'
    WHEN 'FIFTH' THEN 'G5'
    WHEN '6' THEN 'G6'
    WHEN 'G6' THEN 'G6'
    WHEN '6TH' THEN 'G6'
    WHEN 'GRADE 6' THEN 'G6'
    WHEN 'SIXTH' THEN 'G6'
    WHEN '7' THEN 'G7'
    WHEN 'G7' THEN 'G7'
    WHEN '7TH' THEN 'G7'
    WHEN 'GRADE 7' THEN 'G7'
    WHEN 'SEVENTH' THEN 'G7'
    WHEN '8' THEN 'G8'
    WHEN 'G8' THEN 'G8'
    WHEN '8TH' THEN 'G8'
    WHEN 'GRADE 8' THEN 'G8'
    WHEN 'EIGHTH' THEN 'G8'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.normalize_grade_name(text) IS
  'Maps free-text grade values ("KG", "3rd", "Grade 3", etc.) to canonical '
  'grade_levels.name values (KG, G1..G8). Returns NULL for unrecognized input.';


-- ── Helper: normalize_staff_role ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_staff_role(p_raw text)
RETURNS public.staff_role
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(trim(COALESCE(p_raw, '')))
    WHEN 'COACH' THEN 'coach'::public.staff_role
    WHEN 'LITERACY COACH' THEN 'coach'::public.staff_role
    WHEN 'SCHOOL_ADMIN' THEN 'school_admin'::public.staff_role
    WHEN 'SCHOOL ADMIN' THEN 'school_admin'::public.staff_role
    WHEN 'ADMIN' THEN 'school_admin'::public.staff_role
    WHEN 'PRINCIPAL' THEN 'school_admin'::public.staff_role
    WHEN 'AP' THEN 'school_admin'::public.staff_role
    WHEN 'TILT_ADMIN' THEN 'tilt_admin'::public.staff_role
    WHEN 'TILT' THEN 'tilt_admin'::public.staff_role
    ELSE 'tutor'::public.staff_role
  END;
$$;

COMMENT ON FUNCTION public.normalize_staff_role(text) IS
  'Maps free-text role labels to the staff_role enum. Defaults to tutor.';


-- ── Helper: split_person_name ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.split_person_name(
  p_name text,
  OUT first_name text,
  OUT last_name text
)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_trimmed text;
  v_comma_pos int;
  v_parts text[];
  v_n int;
  v_particle text;
  v_last_name_count int;
BEGIN
  v_trimmed := trim(COALESCE(p_name, ''));
  IF v_trimmed = '' THEN
    first_name := NULL;
    last_name := NULL;
    RETURN;
  END IF;

  -- "Last, First" format (highest priority, no ambiguity)
  v_comma_pos := position(',' in v_trimmed);
  IF v_comma_pos > 0 THEN
    last_name := trim(substring(v_trimmed FROM 1 FOR v_comma_pos - 1));
    first_name := trim(substring(v_trimmed FROM v_comma_pos + 1));
    RETURN;
  END IF;

  -- "First [Middle] Last" format with compound last name detection
  v_parts := regexp_split_to_array(v_trimmed, '\s+');
  v_n := array_length(v_parts, 1);

  IF v_n >= 2 THEN
    -- Default: last 1 word is the last name
    v_last_name_count := 1;

    -- HEURISTIC 1: Detect particles (de, von, van, da, di, del, el, al, la, le)
    -- If penultimate word is a particle, combine last 2 words
    IF v_n >= 3 THEN
      v_particle := lower(v_parts[v_n - 1]);
      IF v_particle IN ('de', 'von', 'van', 'da', 'di', 'del', 'el', 'al', 'la', 'le', 'du', 'des', 'du', 'los', 'las') THEN
        v_last_name_count := 2;
      -- HEURISTIC 2: If 4+ words, assume "First Middle Last1 Last2" (compound last name)
      ELSIF v_n >= 4 THEN
        v_last_name_count := 2;
      -- HEURISTIC 3: For 3-word names, check if last word looks like a compound last name marker
      -- (e.g., starts with lowercase after hyphen, or follows another surname)
      -- For now, keep traditional single-word last name for 3-word names without particles
      END IF;
    END IF;

    -- Extract last_name and first_name based on count
    last_name := array_to_string(v_parts[v_n - v_last_name_count + 1:v_n], ' ');
    first_name := array_to_string(v_parts[1:v_n - v_last_name_count], ' ');
  ELSE
    -- Single-word name — treat it as first_name with empty last_name
    first_name := v_trimmed;
    last_name := '';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.split_person_name(text) IS
  'Splits a free-text person name into (first_name, last_name) with compound last name detection.
  Accepts "Last, First" and "First [Middle] Last" formats.

  Compound last name detection heuristics:
  1. "Last, First" format: Explicit — "Garcia Lopez, John" → John | Garcia Lopez
  2. Particles: Detects particles (de, von, van, da, etc.) — "John de Garcia" → John | de Garcia
  3. 4+ words: Assumes "First Middle Last1 Last2" — "John Mary Garcia Lopez" → John Mary | Garcia Lopez
  4. Hyphenated: "John Garcia-Lopez" → John | Garcia-Lopez (inherent in word splitting)';


-- ── import_teachers ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.import_teachers(
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
  v_school_id int;
  v_row record;
  v_first_name text;
  v_last_name text;
  v_existing int;
  v_error_msg text;
  v_imp int := 0;
  v_upd int := 0;
  v_skp int := 0;
  v_err int := 0;
  v_first_errors text[] := ARRAY[]::text[];
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.schools WHERE short_code = p_school_code;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'import_teachers: no school with short_code = %', p_school_code;
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.staging_teachers
    WHERE import_run_id = p_run_id
      AND school_code = p_school_code
      AND transform_status = 'pending'
    ORDER BY id
  LOOP
    BEGIN
      -- Email presence + shape
      IF v_row.email IS NULL OR trim(v_row.email) = '' THEN
        v_error_msg := 'missing email';
        UPDATE public.staging_teachers
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (COALESCE(v_row.teacher_name, '<no name>') || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      IF v_row.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        v_error_msg := 'invalid email format: ' || v_row.email;
        UPDATE public.staging_teachers
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (COALESCE(v_row.teacher_name, '<no name>') || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      -- Parse teacher_name
      SELECT sn.first_name, sn.last_name
      INTO v_first_name, v_last_name
      FROM public.split_person_name(v_row.teacher_name) sn;

      IF v_first_name IS NULL OR v_first_name = '' THEN
        v_error_msg := 'could not parse teacher_name';
        UPDATE public.staging_teachers
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors || v_error_msg;
        END IF;
        CONTINUE;
      END IF;

      -- staff.last_name is NOT NULL; substitute first_name if no last given
      IF v_last_name IS NULL OR v_last_name = '' THEN
        v_last_name := v_first_name;
      END IF;

      -- Was this an insert or an update?
      SELECT COUNT(*) INTO v_existing
      FROM public.staff
      WHERE email = v_row.email;

      INSERT INTO public.staff (
        school_id, first_name, last_name, email, role, is_active
      ) VALUES (
        v_school_id,
        v_first_name,
        v_last_name,
        v_row.email,
        public.normalize_staff_role(v_row.role),
        TRUE
      )
      ON CONFLICT (email) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        is_active = TRUE,
        updated_at = now();

      IF v_existing > 0 THEN
        v_upd := v_upd + 1;
      ELSE
        v_imp := v_imp + 1;
      END IF;

      UPDATE public.staging_teachers
      SET transform_status = 'imported', transform_error = NULL
      WHERE id = v_row.id;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      UPDATE public.staging_teachers
      SET transform_status = 'error', transform_error = v_error_msg
      WHERE id = v_row.id;
      v_err := v_err + 1;
      IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
        v_first_errors := v_first_errors
          || (COALESCE(v_row.teacher_name, '<no name>') || ': ' || v_error_msg);
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

COMMENT ON FUNCTION public.import_teachers(text, text) IS
  'Consumes staging_teachers rows for one (run_id, school_code) pair. '
  'Upserts staff rows by email. Each row succeeds or fails individually; '
  'errors are recorded on the staging row in transform_error.';


-- ── import_students ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.import_students(
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
  v_school_id int;
  v_year_start date;
  v_row record;
  v_first_name text;
  v_last_name text;
  v_grade_name text;
  v_grade_id int;
  v_enrollment date;
  v_existing int;
  v_error_msg text;
  v_imp int := 0;
  v_upd int := 0;
  v_skp int := 0;
  v_err int := 0;
  v_first_errors text[] := ARRAY[]::text[];
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.schools WHERE short_code = p_school_code;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'import_students: no school with short_code = %', p_school_code;
  END IF;

  -- Current FY start_date — used as the default enrollment_date
  SELECT start_date INTO v_year_start
  FROM public.academic_years
  WHERE school_id = v_school_id AND is_current = TRUE
  ORDER BY label DESC
  LIMIT 1;

  IF v_year_start IS NULL THEN
    RAISE EXCEPTION 'import_students: no current academic year for %', p_school_code;
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.staging_students
    WHERE import_run_id = p_run_id
      AND school_code = p_school_code
      AND transform_status = 'pending'
    ORDER BY id
  LOOP
    BEGIN
      -- student_number presence
      IF v_row.student_number IS NULL OR trim(v_row.student_number) = '' THEN
        v_error_msg := 'missing student_number';
        UPDATE public.staging_students
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (COALESCE(v_row.student_name, '<no name>') || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      -- Parse student_name
      SELECT sn.first_name, sn.last_name
      INTO v_first_name, v_last_name
      FROM public.split_person_name(v_row.student_name) sn;

      IF v_first_name IS NULL OR v_first_name = '' THEN
        v_error_msg := 'could not parse student_name';
        UPDATE public.staging_students
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (v_row.student_number || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      IF v_last_name IS NULL OR v_last_name = '' THEN
        v_last_name := v_first_name;
      END IF;

      -- Normalize grade
      v_grade_name := public.normalize_grade_name(v_row.grade_raw);
      IF v_grade_name IS NULL THEN
        v_error_msg := 'unrecognized grade: ' || COALESCE(v_row.grade_raw, '<null>');
        UPDATE public.staging_students
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
          v_first_errors := v_first_errors
            || (v_row.student_name || ': ' || v_error_msg);
        END IF;
        CONTINUE;
      END IF;

      SELECT grade_id INTO v_grade_id
      FROM public.grade_levels
      WHERE name = v_grade_name;

      IF v_grade_id IS NULL THEN
        v_error_msg := 'grade_level row missing for ' || v_grade_name;
        UPDATE public.staging_students
        SET transform_status = 'error', transform_error = v_error_msg
        WHERE id = v_row.id;
        v_err := v_err + 1;
        CONTINUE;
      END IF;

      -- Parse enrollment date (falls back to school year start)
      v_enrollment := NULL;
      IF v_row.enrollment_date_raw IS NOT NULL AND trim(v_row.enrollment_date_raw) <> '' THEN
        BEGIN
          v_enrollment := v_row.enrollment_date_raw::date;
        EXCEPTION WHEN OTHERS THEN
          BEGIN
            v_enrollment := to_date(v_row.enrollment_date_raw, 'MM/DD/YYYY');
          EXCEPTION WHEN OTHERS THEN
            v_enrollment := NULL;
          END;
        END;
      END IF;
      IF v_enrollment IS NULL THEN
        v_enrollment := v_year_start;
      END IF;

      -- Was this an insert or an update?
      SELECT COUNT(*) INTO v_existing
      FROM public.students
      WHERE student_number = v_row.student_number;

      INSERT INTO public.students (
        school_id, grade_id, first_name, last_name, student_number,
        enrollment_status, enrollment_date
      ) VALUES (
        v_school_id, v_grade_id, v_first_name, v_last_name, v_row.student_number,
        'active', v_enrollment
      )
      ON CONFLICT (student_number) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        grade_id = EXCLUDED.grade_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        enrollment_status = 'active',
        enrollment_date = EXCLUDED.enrollment_date,
        updated_at = now();

      IF v_existing > 0 THEN
        v_upd := v_upd + 1;
      ELSE
        v_imp := v_imp + 1;
      END IF;

      UPDATE public.staging_students
      SET transform_status = 'imported', transform_error = NULL
      WHERE id = v_row.id;

    EXCEPTION WHEN OTHERS THEN
      v_error_msg := SQLERRM;
      UPDATE public.staging_students
      SET transform_status = 'error', transform_error = v_error_msg
      WHERE id = v_row.id;
      v_err := v_err + 1;
      IF COALESCE(array_length(v_first_errors, 1), 0) < 10 THEN
        v_first_errors := v_first_errors
          || (COALESCE(v_row.student_name, v_row.student_number, '<null>')
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

COMMENT ON FUNCTION public.import_students(text, text) IS
  'Consumes staging_students rows for one (run_id, school_code) pair. '
  'Upserts students keyed on student_number. Normalizes grade_raw to the '
  'grade_levels.name convention and parses enrollment_date_raw (defaults '
  'to the school current-year start).';
