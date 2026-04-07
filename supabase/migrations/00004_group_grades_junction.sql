-- =============================================================================
-- Adira Reads: Instructional Group Grades junction table
-- =============================================================================
-- Supports mixed-grade groups (D-008). A group can now span multiple grade
-- levels; the junction table holds the additional grades while the existing
-- instructional_groups.grade_id column remains as the "primary" grade for
-- display and sorting.
--
-- Invariant: for every instructional_groups row there should be at least one
-- matching row in instructional_group_grades, with the grade_id matching the
-- parent row. Additional rows represent additional grades for mixed-grade
-- groups. A backfill inserts a junction row for every existing group.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.instructional_group_grades (
  group_id INT NOT NULL REFERENCES public.instructional_groups(group_id) ON DELETE CASCADE,
  grade_id INT NOT NULL REFERENCES public.grade_levels(grade_id),
  PRIMARY KEY (group_id, grade_id)
);

-- RLS: school-scoped via the parent instructional_groups row
ALTER TABLE public.instructional_group_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_via_group" ON public.instructional_group_grades;
CREATE POLICY "school_via_group" ON public.instructional_group_grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = instructional_group_grades.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = instructional_group_grades.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );

-- Backfill: insert one junction row per existing group, copying grade_id
INSERT INTO public.instructional_group_grades (group_id, grade_id)
SELECT group_id, grade_id
FROM public.instructional_groups
ON CONFLICT (group_id, grade_id) DO NOTHING;
