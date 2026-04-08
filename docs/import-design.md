# Real-School Data Import — Design Doc

> **Status:** DRAFT · open questions in §5 · no code written yet
>
> **Audience:** Christina + Claude (working doc, edit in place)
>
> **Purpose:** Decide how to import real school data (teachers, students,
> initial assessments, historical lesson checks) from the legacy Google
> Sheets / Apps Script system into the Adira Reads Supabase platform.

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

### Q1. Source format

What format will the data arrive in?

- [ ] CSV exports from Google Sheets (one CSV per sheet tab)
- [ ] Google Sheets published to web as CSV URLs
- [ ] Direct Supabase SQL dump from another system
- [ ] Other: _________

**Christina's answer:**

> _TBD_

---

### Q2. Pilot school vs all schools

Do we pilot with one school first, then fan out, or import all six
schools in parallel?

- [ ] One pilot school first (strongly recommended) — which one?
- [ ] All schools at once

**Christina's answer:**

> _TBD_

---

### Q3. Historical lesson data — group attribution

Which of the three options from §3.2 do we use?

- [ ] **Option A** — Preserve historical groups (3× work, no data loss)
- [ ] **Option B** — One "Historical" group per school (simple, loses teacher attribution)
- [ ] **Option C** — Null group_id for import source (cleanest, loses all group context)

**Claude's recommendation:** Option B.

**Christina's answer:**

> _TBD_

---

### Q4. Historical depth

How much historical lesson data do we import?

- [ ] Current school year only
- [ ] Last 2 years
- [ ] Everything available
- [ ] Other: _________

**Volume implication:** per the data model doc (Section A), each school
has ~2,000-4,000 `lesson_progress` rows per year. Six schools × N years
× ~3,000 rows ≈ 18,000 × N rows. Not huge but affects tuning.

**Christina's answer:**

> _TBD_

---

### Q5. Teacher authentication flow

Pre-created staff rows + email-claim on first login (recommended), or
manual auth account provisioning per teacher?

- [ ] Pre-created + email-claim (auto on first successful magic link login)
- [ ] Manual per teacher
- [ ] Other: _________

**Christina's answer:**

> _TBD_

---

### Q6. Initial assessment snapshot type

The legacy system captured a single "Initial Assessment" per student
(no semester snapshots). Historical assessment rows imported into
Adira Reads should be recorded as:

- [ ] `baseline` (recommended — matches the frozen BOY reference semantics)
- [ ] Split by date — any assessment before MOY cutoff = `baseline`, between MOY and EOY = `semester_1_end`, after EOY = `semester_2_end`
- [ ] Other: _________

**Christina's answer:**

> _TBD_

---

### Q7. Re-runnability

Should we build in the ability to truncate + re-import one school
without touching other schools?

- [ ] Yes — add `school_id` scoping to the teardown helper (recommended for the pilot phase)
- [ ] No — we only import each school once, ever
- [ ] Teardown is fine but per-school scoping is overkill

**Christina's answer:**

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
