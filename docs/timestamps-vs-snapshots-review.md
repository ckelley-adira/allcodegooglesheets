# Timestamps vs. Snapshots — Architecture Review

## Context

Christina shared an alternative CLAUDE.md that prescribes a **"timestamped records, never manual snapshots"** architecture. This plan compares that document's recommendations against the current codebase to determine what (if anything) should change.

---

## Document vs. Reality — Gap Analysis

| Topic | Document says | Current codebase does | Assessment |
|-------|--------------|----------------------|------------|
| **Timestamps** | Every table gets `created_at` + `updated_at` with auto-trigger | `created_at` on most tables; **no `updated_at`** (by design — records are immutable) | Mixed — see below |
| **Snapshots** | "Do NOT implement manual snapshot jobs" | `weekly_snapshots` table + `captureWeeklySnapshots()` actively used for growth dashboards | **Keep snapshots** — they serve a real purpose |
| **ORM** | Drizzle is source of truth; never raw Supabase SQL | Drizzle configured, but **DAL uses Supabase PostgREST** for all queries | Current is fine — PostgREST + RLS is the intended Supabase pattern |
| **Package mgr** | pnpm | npm | Irrelevant to this analysis |
| **Query pattern** | Filter by timestamp range, not snapshot ID | Queries use `date_recorded` (business date) ranges + snapshot table for pre-aggregated metrics | Current is correct |

---

## Recommendation: Keep the current hybrid approach

The document's "never snapshot" rule is wrong for this domain. Here's why:

### 1. Immutable records don't need `updated_at`

`lesson_progress` rows are **append-only by design**. When a tutor re-records a lesson, the system upserts on `(student_id, lesson_id, year_id, date_recorded)` — it doesn't modify the old row's meaning, it replaces the record for that date. The `created_at` timestamp is sufficient because there's no history of changes to a single row. This aligns with the audit-log philosophy (D-006) and Equity of Visibility (D-012).

Adding `updated_at` to `lesson_progress` would imply records are mutable when they shouldn't be.

### 2. Weekly snapshots exist for a good reason

The `captureWeeklySnapshots()` function pre-computes expensive aggregations:
- Deduplicates multi-record lessons (Y > N > A priority)
- Excludes absence-only lessons (D-012)
- Computes growth_pct against aimline (2 lessons/week)

Without this pre-computation, every dashboard render would re-aggregate the entire `lesson_progress` table. At 2,000+ students x 128 lessons x multiple dates, that's a lot of rows to crunch on every page load. The snapshot table makes dashboards fast and consistent.

### 3. Where `updated_at` WOULD help

Some tables contain genuinely mutable entity records:

| Table | Why `updated_at` matters |
|-------|-------------------------|
| `students` | Name corrections, enrollment status changes, grade reassignment |
| `staff` | Role changes, name updates |
| `schools` | Config changes (cadence_days, etc.) |
| `instructional_groups` | Rename, deactivate, staff reassignment |
| `benchmark_records` | Currently has NO timestamps at all |

These are the tables where you might want to know "when was this last modified?" For these, adding `updated_at` + an auto-trigger is a reasonable improvement.

---

## Proposed Changes (small, targeted)

### Add `updated_at` to mutable entity tables only

**Tables to modify** (via Drizzle migration):
- `students` — add `updated_at timestamptz default now() not null`
- `staff` — add `updated_at timestamptz default now() not null`
- `schools` — add `updated_at timestamptz default now() not null`
- `instructional_groups` — add `updated_at timestamptz default now() not null`
- `benchmark_records` — add `created_at timestamptz default now() not null` (missing entirely) + `updated_at`

**Create a shared Postgres trigger** to auto-update `updated_at` on row modification:
```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Then attach it to each table above.

### Do NOT change
- `lesson_progress` — keep immutable, no `updated_at`
- `assessment_results` — keep immutable, no `updated_at`
- `weekly_snapshots` — keep the snapshot pattern, it's doing what it should
- `band_assignments` — immutable per-date snapshots, correct as-is

---

## Files to modify

| File | Change |
|------|--------|
| `web/src/lib/db/schema/core.ts` | Add `updatedAt` column to students, staff, schools, instructional_groups |
| `web/src/lib/db/schema/tracking.ts` | Add `createdAt` + `updatedAt` to benchmark_records |
| New migration file | DDL for columns + trigger function + trigger attachments |

---

## Verification

1. Run `pnpm drizzle-kit generate` (or the npm equivalent) to produce the migration
2. Apply migration to Supabase dev branch
3. Verify existing queries still work (no breaking changes — new columns have defaults)
4. Test: update a student record, confirm `updated_at` auto-updates
5. Confirm `lesson_progress` remains untouched (no `updated_at`)
