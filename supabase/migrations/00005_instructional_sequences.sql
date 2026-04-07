-- =============================================================================
-- Adira Reads: Instructional Sequences
-- =============================================================================
-- A group has an ordered list of UFLI lessons it's working through — an
-- "Instructional Sequence." Philosophically: "catch them before they fall"
-- at a cadence of 2 lessons per week, ~8 lessons per 4-week sequence.
--
-- A group has multiple sequences over a school year. At most one is active
-- at a time; the rest are either draft (future) or completed (history).
-- Each sequence has an ordered list of lessons with optional planned dates
-- and per-lesson status. Exactly one lesson in an active sequence is the
-- "current" lesson — the one the Tutor Input Form pre-selects.
--
-- Advancement is always manual via a button click (D-005 human authority).
-- =============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE sequence_status AS ENUM ('draft', 'active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sequence_lesson_status AS ENUM ('upcoming', 'current', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── Schools: cadence_days column ─────────────────────────────────────────────
-- Per-school default cadence for instructional sequence planned dates.
-- Stored as a comma-separated list of 3-letter day codes: MON,TUE,WED,THU,FRI.
-- Default Tue/Thu — the most common 2-per-week cadence.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS cadence_days VARCHAR(30) NOT NULL DEFAULT 'TUE,THU';


-- ── instructional_sequences ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instructional_sequences (
  sequence_id   SERIAL PRIMARY KEY,
  group_id      INT NOT NULL REFERENCES public.instructional_groups(group_id) ON DELETE CASCADE,
  year_id       INT NOT NULL REFERENCES public.academic_years(year_id),
  name          VARCHAR(100) NOT NULL,
  start_date    DATE,
  end_date      DATE,
  status        sequence_status NOT NULL DEFAULT 'active',
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one active sequence per group. Enforced via partial unique index
-- so a group can have any number of drafts/completed but only one active.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_sequence_per_group
  ON public.instructional_sequences (group_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sequences_group_year
  ON public.instructional_sequences (group_id, year_id);


-- ── instructional_sequence_lessons ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instructional_sequence_lessons (
  sequence_id   INT NOT NULL REFERENCES public.instructional_sequences(sequence_id) ON DELETE CASCADE,
  lesson_id     INT NOT NULL REFERENCES public.ufli_lessons(lesson_id),
  sort_order    INT NOT NULL,
  planned_date  DATE,
  status        sequence_lesson_status NOT NULL DEFAULT 'upcoming',
  completed_at  TIMESTAMPTZ,
  PRIMARY KEY (sequence_id, lesson_id)
);

-- At most one 'current' lesson per sequence. The Tutor Input Form reads
-- this to pre-select the lesson when a tutor opens a group.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_lesson_per_sequence
  ON public.instructional_sequence_lessons (sequence_id)
  WHERE status = 'current';

CREATE INDEX IF NOT EXISTS idx_sequence_lessons_sequence
  ON public.instructional_sequence_lessons (sequence_id, sort_order);


-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.instructional_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructional_sequence_lessons ENABLE ROW LEVEL SECURITY;

-- Sequences: school-scoped via the parent instructional_group
DROP POLICY IF EXISTS "school_via_group" ON public.instructional_sequences;
CREATE POLICY "school_via_group" ON public.instructional_sequences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = instructional_sequences.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instructional_groups g
      WHERE g.group_id = instructional_sequences.group_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );

-- Sequence lessons: school-scoped via the parent sequence's group
DROP POLICY IF EXISTS "school_via_sequence" ON public.instructional_sequence_lessons;
CREATE POLICY "school_via_sequence" ON public.instructional_sequence_lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.instructional_sequences s
      JOIN public.instructional_groups g ON g.group_id = s.group_id
      WHERE s.sequence_id = instructional_sequence_lessons.sequence_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.instructional_sequences s
      JOIN public.instructional_groups g ON g.group_id = s.group_id
      WHERE s.sequence_id = instructional_sequence_lessons.sequence_id
        AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())
    )
  );
