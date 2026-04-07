-- =============================================================================
-- Adira Reads: Row Level Security Policies
-- =============================================================================
-- Per D-002 and D-015: RLS is enforced at the database layer from day one.
-- Every table with a school_id column gets an RLS policy that filters by
-- the authenticated user's JWT claim: (auth.jwt() -> 'app_metadata' ->> 'school_id').
--
-- TILT Admin bypasses school filtering via the 'is_tilt_admin' claim (D-002).
-- The audit_log table is append-only: no UPDATE or DELETE (D-004).
-- =============================================================================

-- Helper function: extract the current user's school_id from their JWT
CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'school_id')::INT,
    0  -- returns 0 (matches nothing) if no claim present
  );
$$;

-- Helper function: check if current user is a TILT Admin
CREATE OR REPLACE FUNCTION public.is_tilt_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_tilt_admin')::BOOLEAN,
    FALSE
  );
$$;


-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view their own school"
  ON public.schools FOR SELECT
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );

CREATE POLICY "Only TILT Admin can modify schools"
  ON public.schools FOR ALL
  USING (public.is_tilt_admin())
  WITH CHECK (public.is_tilt_admin());


-- ---------------------------------------------------------------------------
-- academic_years
-- ---------------------------------------------------------------------------
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped academic years"
  ON public.academic_years FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );


-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped staff"
  ON public.staff FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );


-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped students"
  ON public.students FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );


-- ---------------------------------------------------------------------------
-- instructional_groups
-- ---------------------------------------------------------------------------
ALTER TABLE public.instructional_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped groups"
  ON public.instructional_groups FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );


-- ---------------------------------------------------------------------------
-- group_memberships (school_id via join to instructional_groups)
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped memberships"
  ON public.group_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = group_memberships.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = group_memberships.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- lesson_progress (school_id via join to students)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped lesson progress"
  ON public.lesson_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = lesson_progress.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = lesson_progress.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- grade_levels — reference data, readable by all authenticated users
-- ---------------------------------------------------------------------------
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read grade levels"
  ON public.grade_levels FOR SELECT
  USING (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- ufli_lessons — reference data, readable by all authenticated users
-- ---------------------------------------------------------------------------
ALTER TABLE public.ufli_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read UFLI lessons"
  ON public.ufli_lessons FOR SELECT
  USING (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- assessment_sequences — reference data, readable by all
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessment_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read assessment sequences"
  ON public.assessment_sequences FOR SELECT
  USING (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- assessment_results (school_id via join to students)
-- ---------------------------------------------------------------------------
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped assessment results"
  ON public.assessment_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = assessment_results.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = assessment_results.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- sounds_catalog — reference data
-- ---------------------------------------------------------------------------
ALTER TABLE public.sounds_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read sounds catalog"
  ON public.sounds_catalog FOR SELECT
  USING (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- sound_inventory (school_id via join to students)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sound_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped sound inventory"
  ON public.sound_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = sound_inventory.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = sound_inventory.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- tutoring_sessions (school_id via join to students)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutoring_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped tutoring sessions"
  ON public.tutoring_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = tutoring_sessions.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = tutoring_sessions.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- benchmark_records (school_id via join to students)
-- ---------------------------------------------------------------------------
ALTER TABLE public.benchmark_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped benchmarks"
  ON public.benchmark_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = benchmark_records.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = benchmark_records.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- weekly_snapshots (school_id via join to students)
-- ---------------------------------------------------------------------------
ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped weekly snapshots"
  ON public.weekly_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = weekly_snapshots.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.student_id = weekly_snapshots.student_id
        AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- coaching_metrics (school_id via join to instructional_groups)
-- ---------------------------------------------------------------------------
ALTER TABLE public.coaching_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped coaching metrics"
  ON public.coaching_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = coaching_metrics.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = coaching_metrics.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- feature_settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.feature_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped feature settings"
  ON public.feature_settings FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );


-- ---------------------------------------------------------------------------
-- import_log
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped import log"
  ON public.import_log FOR ALL
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );


-- ---------------------------------------------------------------------------
-- import_exceptions (school_id via join to import_log)
-- ---------------------------------------------------------------------------
ALTER TABLE public.import_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped import exceptions"
  ON public.import_exceptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.import_log il
      WHERE il.import_id = import_exceptions.import_id
        AND (il.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.import_log il
      WHERE il.import_id = import_exceptions.import_id
        AND (il.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );


-- ---------------------------------------------------------------------------
-- audit_log — APPEND ONLY (D-004)
-- School-scoped for reads, insert-only for writes.
-- No UPDATE or DELETE policy is created — the database enforces immutability.
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School-scoped audit log reads"
  ON public.audit_log FOR SELECT
  USING (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );

CREATE POLICY "Authenticated users can insert audit entries"
  ON public.audit_log FOR INSERT
  WITH CHECK (
    school_id = public.current_user_school_id()
    OR public.is_tilt_admin()
  );

-- Explicitly: NO UPDATE or DELETE policies on audit_log.
-- This is the database-level enforcement of D-004.
