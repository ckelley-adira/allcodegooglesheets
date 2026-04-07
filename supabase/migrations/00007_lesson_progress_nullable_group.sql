-- =============================================================================
-- Adira Reads: lesson_progress.group_id nullable for assessment-sourced rows
-- =============================================================================
-- Initial assessments often happen BEFORE a student is placed in an
-- instructional group — assessments are how teachers decide grouping in
-- the first place. To let the assessment submit flow seed lesson_progress
-- (so the Big Four high-water-mark logic picks up baseline mastery
-- automatically), group_id must be allowed to be NULL.
--
-- Tutor session rows still always have a group_id; only source='assessment'
-- rows are expected to be group-less. This is enforced by a CHECK constraint.
-- =============================================================================

ALTER TABLE public.lesson_progress
  ALTER COLUMN group_id DROP NOT NULL;

-- Group is required for everything except assessment-seeded baselines.
ALTER TABLE public.lesson_progress
  DROP CONSTRAINT IF EXISTS chk_group_required_unless_assessment;

ALTER TABLE public.lesson_progress
  ADD CONSTRAINT chk_group_required_unless_assessment
  CHECK (group_id IS NOT NULL OR source = 'assessment');
