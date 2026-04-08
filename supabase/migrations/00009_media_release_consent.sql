-- =============================================================================
-- Adira Reads: Student media release consent flag (Phase D.5 prelude)
-- =============================================================================
-- Adds an optional mediaReleaseConsent boolean on the students table.
-- Used by Tier 2+ grant reporting templates (Executive One-Pager, etc.)
-- that include named-student stories to verify the student has signed
-- media release on file before rendering them in an external report.
--
-- Nullable on purpose — null means "consent status unknown", which is
-- the safest default until the permission tracking workflow lands.
-- No UI surface and no templates reference this column in Tier 1.
-- =============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS media_release_consent BOOLEAN;
