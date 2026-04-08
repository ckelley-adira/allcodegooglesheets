-- =============================================================================
-- Adira Reads: weekly_snapshots.growth_pct precision fix
-- =============================================================================
-- The original column was NUMERIC(5,2) which caps at 999.99. That's
-- only 20 lessons-per-week at the 2-lessons/week aimline, and real
-- catch-up weeks (plus the grant-report fixture stress cases in
-- 003_grant_report_fixtures.sql) can exceed it, producing:
--
--    Failed to upsert weekly_snapshots: numeric field overflow
--
-- Widening to NUMERIC(6,2) allows up to 9999.99 (about 99 lessons
-- per week) — comfortably above any realistic ceiling and well above
-- the fixture stress cases.
-- =============================================================================

ALTER TABLE public.weekly_snapshots
  ALTER COLUMN growth_pct TYPE NUMERIC(6,2);
