# Real-School Data Import — Design Doc

> **Status:** questions answered 2026-04 · ready to start IM.1
>
> **Audience:** Christina + Claude (working doc, edit in place)
>
> **Purpose:** Decide how to import real school data (teachers, students,
> initial assessments, historical lesson checks) from the legacy Google
> Sheets / Apps Script system into the Adira Reads Supabase platform.
>
> **Pilot schools:** CCA, Allegiant, Global Prep. 150 students total.

---

## 1. Scope

Four data streams to migrate per school:

| # | Stream | Source | Destination |
|---|---|---|---|
| 1 | **Teachers** | Sheets: Site Config / Staff tab | `staff` + `auth.users` (first-login claim) |
| 2 | **Students** | Sheets: Student Roster tab | `students` |
| 3 | **Initial Assessment Data** | Sheets: Initial Assessment tab | `initial_assessments` + `initial_assessment_lessons` + synthetic `lesson_progress` (source='assessment') |
| 4 | **Historical Lesson Check Data** | Sheets: Small Group Progress + SGPArchive + UFLI MAP | `lesson_progress` (source='import') + one "Historical" group per school |

The `assessment_component_errors` table stays empty for imported students
— the legacy system only captured lesson-level results, not component-
level. New assessments run through the wizard will populate it.

---

## 2. Architecture — staging + transform

```
┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐    ┌──────────┐
│ CSV exports  │ →  │ staging_* tables │ →  │ transform          │ →  │  live    │
│ (per sheet)  │    │ (permissive text │    │ PL/pgSQL functions │    │  tables  │
│              │    │  columns, no FK) │    │ (validate + upsert)│    │          │
└──────────────┘    └──────────────────┘    └────────────────────┘    └──────────┘
```

**Why staging tables (not direct SQL INSERT or Supabase API scripts):**

- **Re-runnable.** Bad row? Fix it in staging, re-run the transform. No
  second export from the legacy system.
- **Auditable.** Staging tables persist for ~6 months as a record of
  "what was imported on date X."
- **Rollback-safe.** If the transform goes sideways, truncate the live
  tables (we're still pre-cutover) and re-run.
- **Type-safe at the boundary.** Staging takes raw strings; transform
  casts + validates + matches FKs.

### 2.1 Staging tables (proposed)

```sql
staging_teachers
  import_run_id, school_code, email, first_name, last_name, role, notes

staging_students
  import_run_id, school_code, student_number, first_name, last_name,
  grade_raw, enrollment_date_raw, notes

staging_initial_assessments
  import_run_id, school_code, student_number, assessment_date_raw,
  snapshot_type, lesson_results_json, notes
  -- lesson_results_json shape: {"L1":"Y","L2":"N","L3":"",...}
  -- review lessons included but ignored by transform

staging_lesson_progress
  import_run_id, school_code, student_number, lesson_number,
  status, date_recorded_raw, teacher_email, group_label, notes
```

`import_run_id` is a UUID/string tag so multiple schools (or multiple
retries) can share the same staging table without cross-contamination.

### 2.2 Transform functions

```sql
import_teachers(p_run_id text, p_school_code text)
  returns table(imported int, updated int, skipped int, errors text[])

import_students(p_run_id text, p_school_code text)
  returns table(imported int, updated int, skipped int, errors text[])

import_initial_assessments(p_run_id text, p_school_code text)
  returns table(imported int, skipped int, errors text[])

import_historical_lessons(p_run_id text, p_school_code text)
  returns table(imported int, skipped int, errors text[])
```

Each function:
- Validates required fields
- Casts raw text columns (grades, dates) to typed destinations
- Matches foreign keys by natural keys (email, student_number, lesson_number)
- Upserts on `ON CONFLICT` of the appropriate unique constraint
- Returns a row-level error summary rather than raising — so one bad
  row doesn't kill the whole batch

### 2.3 Teardown helper

```sql
import_teardown_school(p_school_code text)
  -- Truncates all live-table rows scoped to one school
  -- (for re-runs during the pilot phase only — not for production use)
```

---

## 3. Hard problems + proposed handling

### 3.1 Teacher authentication

Creating a `staff` row doesn't let the teacher log in. They need:

1. An `auth.users` row in Supabase Auth
2. JWT custom claims (`school_id`, `role`, `is_tilt_admin`) on that user
3. `staff.auth_uid` populated with the new user's UUID

**Proposed flow:**
- Import writes `staff` rows with `auth_uid = NULL` and a known email
- Each teacher receives an invite email (Supabase Auth magic link)
- On first successful login, a tiny server action matches the
  authenticated user's email to a `staff` row with a NULL `auth_uid` and
  the same email, and writes the UUID in + triggers the custom-claims
  hook
- No manual per-teacher account provisioning from the ops side

**Not in scope for the import itself:** the first-login claiming page.
That lands as a separate small commit (one page + one server action)
before the first real teacher tries to log in.

### 3.2 Historical `lesson_progress.group_id`

`lesson_progress` requires a `group_id` for non-assessment rows. Historical
data was recorded against groups that may no longer exist.

**Three options:**

| Option | Approach | Pros | Cons |
|---|---|---|---|
| **A** | Preserve historical groups — import every group + membership from the sheets as inactive groups | No data loss, can answer "Ms. Smith's 2025 group" questions | 3× the work; fragile mapping; groups may not have clean identifiers in legacy sheets |
| **B** | One "Historical" group per school — all historical lesson_progress rows assigned to it (flagged `is_active = false`) | Clean schema, student-level metrics work exactly, simpler import | Loses teacher-level attribution for historical data; Coaching page can't ask "who retaught this lesson in 2024?" for old data |
| **C** | Allow `group_id = NULL` for source='import' rows (matches what we did for source='assessment') | Cleanest schema, zero group ceremony | Loses ALL group context — even the school-level rollups become slightly off |

**Christina's pick:** _TBD — see §5 Q3._

### 3.3 Grade name normalization

Source data may say "3", "3rd", "Grade 3", "G3", "Three". Destination
is `grade_levels.name` where values are exactly "KG", "G1"..."G8".

**Proposed:** the `import_students()` transform does the normalization
inline. Anything that can't be parsed goes to the error list for
manual inspection.

### 3.4 Academic year mapping

Historical rows span multiple school years. Each row needs a `year_id`.

**Proposed:** the transform looks at `date_recorded` and picks the
`academic_years` row where the date falls within `[start_date, end_date]`.
If no year matches (e.g. a date before the first imported year), the
row goes to the error list.

**Implication:** all relevant `academic_years` rows must exist BEFORE
the import runs. That's a one-time setup step per school.

---

## 4. Proposed build order

Each step is a separate commit. None of them write to live tables
until step 3 — earlier steps are staging infrastructure only.

- **IM.1** — Staging table migration (`migration 00011_import_staging.sql`) + school-scoped teardown helper
- **IM.2** — `import_teachers()` + `import_students()` PL/pgSQL functions with dry-run mode
- **IM.3** — CSV loading instructions + worked example for a pilot school (teachers + students only, verified against current state)
- **IM.4** — `import_initial_assessments()` function + lesson_progress seeding (source='assessment')
- **IM.5** — "Historical" group scaffolding (Option B) + `import_historical_lessons()` function
- **IM.6** — First-login email-claiming page (`/auth/claim`) so teachers can authenticate into pre-imported staff rows
- **IM.7** — End-to-end dry run against one pilot school + verification checklist (row counts, Big Four comparison against source)

---

## 5. Open questions (answer inline)

### Q1. Source format ✅

What format will the data arrive in?

- [x] **CSV exports from Google Sheets (one CSV per sheet tab)**
- [ ] Google Sheets published to web as CSV URLs
- [ ] Direct Supabase SQL dump from another system

**Implication:** staging table load will use Supabase's CSV import
(`COPY FROM STDIN` via the SQL Editor, or the Supabase dashboard's
table editor CSV upload). Every staging table has a 1:1 column mapping
to the expected source CSV headers so the upload is zero-transform.

---

### Q2. Pilot school vs all schools ✅

- [x] **Three pilot schools in parallel: CCA, Allegiant, Global Prep**
  — 150 students total, chosen as a good cross-section of unique
  features across the network.

**Implications:**
- **Allegiant** and **Global Prep** don't exist in the schools table
  yet. They need to be created before IM.2 runs (either as a manual
  INSERT or as part of IM.1). Short codes TBD — see §5.1.
- **CCA** already exists in the test data seed (`002_test_data.sql`).
  The real CCA data import will collide with the test data. Before
  IM.2 runs for CCA, the teardown helper (Q7 below) must wipe the
  test-CCA state scoped to `short_code = 'CCA'`.
- The "three schools in parallel" framing means the staging tables
  need to handle cross-school imports cleanly. The `school_code`
  column already covers this — each transform function takes one
  school at a time so they can be run independently per school even
  when staging holds all three.

---

### Q3. Historical lesson data — group attribution ✅

- [x] **Option A — Preserve historical groups**, with a twist: Christina
  creates the groups manually through the new Groups page AFTER
  staff + students are imported and BEFORE historical lesson data
  lands. The import transform then matches each historical lesson
  row to an existing group by `(group_name, teacher_email)` and
  uses its `group_id`.

**Flow:**
1. IM.2 — staff + students imported
2. **Christina uses `/dashboard/groups` to create each group + assign
   teachers + add rosters** (manual step, happens outside the
   migration flow)
3. IM.5 — historical lesson import runs. For each staging row, the
   transform looks up `instructional_groups` filtered by
   `school_id + group_name` and uses the returned `group_id`. If no
   match, the row goes to the error list for manual resolution.

**Implication for staging schema:** the `staging_lesson_progress` table
needs both `group_label` (the group name from the legacy sheet) and
`teacher_email` (for disambiguation when two groups share a name).
The transform function matches on `group_label` first, falls back to
`group_label + teacher_email` if multiple groups match.

This is cleaner than the pure Option A pattern I originally described
because Christina's pre-work lets her use the real Groups UI to build
the groups with correct grade assignments, rosters, and teacher
assignments — instead of us trying to reverse-engineer that from the
legacy sheet structure.

---

### Q4. Historical depth ✅

- [x] **Current school year only** (FY26 — roughly Aug 2025 through
  today).

**Implications:**
- The `import_historical_lessons()` transform filters staging rows by
  `date_recorded` and only inserts rows where the date falls inside
  the current `academic_years` row for that school. Anything outside
  that window goes to the error list.
- Volume: ~3,000 lesson_progress rows × 3 schools ≈ 9,000 rows total.
  Trivial for Supabase to handle in one batch.
- Weekly snapshots + band assignments will be rebuilt from scratch
  after the import via the existing `/dashboard/snapshots → Recompute`
  button — they aren't imported directly.

---

### Q5. Teacher authentication flow ✅

- [x] **Pre-created + email-claim (auto on first successful magic link
  login).**

**Flow:**
1. IM.2 inserts `staff` rows with `auth_uid = NULL`, real emails from
   the legacy sheet
2. A teacher hits `/login`, requests a magic link to their email
3. They click the link — Supabase Auth creates an `auth.users` row
   on first successful login
4. IM.6's `/auth/claim` server action runs after auth:
   - Matches `auth.users.email` to a `staff` row with
     `auth_uid IS NULL` and equal `email`
   - Sets `staff.auth_uid = auth.users.id`
   - Triggers the custom-claims hook to populate JWT claims
     (`school_id`, `role`, `is_tilt_admin`)
5. Teacher lands on `/dashboard` authenticated + school-scoped

**Edge cases the claim action must handle:**
- Email matches zero staff rows → show a friendly "not invited yet"
  page, let TILT Admin add them via the Staff page
- Email matches multiple rows (shouldn't happen — `staff.email` has a
  unique constraint) → error
- `auth_uid` already set → pass through normally, do nothing

---

### Q6. Initial assessment snapshot type ✅

- [x] **`baseline`** (matches the frozen BOY reference semantics).

**Implication:** the `import_initial_assessments()` transform always
writes `snapshot_type = 'baseline'`. If a student already has a
baseline row for the same `(student_id, year_id)`, the transform
updates it in place via `ON CONFLICT (student_id, year_id,
snapshot_type) DO UPDATE`. Re-running the import refreshes the
baseline; there's no risk of duplicates.

---

### Q7. Re-runnability ✅

- [x] **Yes — add `school_id` scoping to the teardown helper.**

**Implication:** `import_teardown_school(p_school_code)` deletes rows
in dependency order scoped to one school:

```
band_assignments           (via student.school_id)
weekly_snapshots           (via student.school_id)
assessment_component_errors (via assessment → student.school_id)
initial_assessment_lessons  (via assessment → student.school_id)
initial_assessments        (via student.school_id)
lesson_progress            (via student.school_id)
group_memberships          (via group.school_id)
instructional_sequence_lessons + instructional_sequences  (via group)
instructional_groups       (via school_id)
students                   (via school_id)
staff                      (via school_id)
```

Schools + academic_years are preserved so the school row itself
remains. The teardown intentionally does NOT touch audit_log —
keeping the teardown event in the audit trail is the whole point.

This is a pilot-phase tool. Once a school is live with real teacher
usage, the teardown helper should be removed or require an explicit
"I know what I'm doing" confirmation parameter.

---

## 5.1 Follow-up questions surfaced by the answers

These are smaller than Q1–Q7 but need answers before IM.1 runs.

### Q1a. School short codes for Allegiant + Global Prep

`schools.short_code` is a unique `VARCHAR(10)` used as the natural key
throughout the import pipeline (it's how staging rows identify which
school they belong to). CCA already exists with `short_code = 'CCA'`.
The other two need codes:

- **Allegiant** — proposed: `ALLEG` (or `ALG`? Chrstina's preference)

  > _TBD_

- **Global Prep** — proposed: `GPA` (Global Prep Academy) or `GP`

  > _TBD_

### Q1b. Test-data CCA collision

The test data seed `supabase/seed/002_test_data.sql` already created
CCA with fake teachers, students, groups, and lesson_progress. The
real CCA import needs to wipe that state first.

**Recommendation:** run `import_teardown_school('CCA')` as the first
step of the CCA import. Allegiant and Global Prep don't have this
problem because they don't exist yet.

> _Confirm OK to wipe test-CCA data before real import: TBD_

### Q1c. Academic year creation for new schools

`academic_years` rows need to exist before any lesson_progress import
can resolve a `year_id` for its dates. CCA has one (from the test
seed), but Allegiant and Global Prep don't.

**Proposed:** IM.1 migration creates the schools table entries AND
the `academic_years` row for each new pilot school, using FY26 with
start_date=2025-08-01, end_date=2026-06-30, is_current=true. Matches
the test seed convention.

> _Confirm dates + label for FY26: TBD_

### Q1d. Source CSV column mapping

Each of the 4 staging tables needs to match the header row of the
actual legacy sheet CSV export. I can propose a mapping based on the
`.gs` files in `docs/` — but Christina needs to verify the exact
column names by exporting one sheet and pasting the header row here:

**Staff tab header row from Global Prep (or any pilot):**
> _TBD — paste first row of exported CSV_

**Student Roster tab header row:**
> _TBD_

**Initial Assessment tab header row:**
> _TBD_

**Small Group Progress tab header row:**
> _TBD_

---

## 6. Out of scope / explicit non-goals

- **Live sync with Google Sheets.** One-shot import only. Schools cut
  over entirely from the legacy system on a specific date per D-016.
- **`assessment_component_errors` backfill.** Legacy data is
  lesson-level only. Component-level diagnostic data gets captured
  going forward via the wizard.
- **Weekly snapshot backfill.** The capture composer runs forward
  from the cutover date. Historical weekly growth trends can be
  reconstructed from `lesson_progress` later if needed, but aren't
  imported directly.
- **`band_assignments` backfill.** Bands compute from the current
  high-water-mark state. Running `/dashboard/snapshots → Recompute`
  after the lesson_progress import populates bands automatically.
- **Sound Inventory / Fry Word data.** Not in the Tier 1 migration
  set. Those subsystems don't have destination tables populated yet
  (schema exists but no app code). Revisit in Phase E.
- **`audit_log` replay.** Legacy audit trail isn't migrated. The
  Adira Reads audit log starts fresh on cutover day.

---

## 7. Rough timeline (once questions are answered)

| Phase | Scope | Dependency |
|---|---|---|
| Design | This doc, questions answered | Today |
| IM.1-IM.2 | Staging + teardown + teacher/student transforms | After Q1, Q5, Q7 |
| IM.3 | Pilot dry-run of teachers + students | After IM.2 |
| IM.4 | Initial assessment import | After Q6 |
| IM.5 | Historical lesson import | After Q3, Q4 |
| IM.6 | First-login claim page | After Q5, before first real teacher login |
| IM.7 | Full dry run + verification | After all above |
| Cutover | One school goes live | After IM.7 + business decision |

No calendar estimates on this list — depends on how quickly the
questions get answered and how clean the source data is. Experience
suggests "clean" is never the right assumption; budget for iteration.
