# Import Runbook — How to Actually Run an Import

> Companion to `import-design.md`. The design doc says what we're
> building; this doc says how to use it. Step-by-step, copy-pasteable.

## Before you start (one-time)

1. **Migrations 00011–00014 must be applied** in Supabase SQL Editor.
   Verify with this query:

   ```sql
   SELECT proname, pronargs
   FROM pg_proc
   WHERE proname IN (
     'import_teachers',
     'import_students',
     'import_initial_assessments',
     'import_historical_lessons',
     'import_teardown_school'
   )
   ORDER BY proname;
   ```

   You should see five rows. If any are missing, apply the
   corresponding migration first.

2. **Pick a run id** for the full import session. Convention:
   `{school_short_code}-{yyyymmdd}` like `cca-20260415` or
   `gpa-20260415`. The same run id is used across all four staging
   tables for that school's import session — it's just a tag for
   tracking which rows belong together.

3. **Have the CSVs ready.** You'll upload one per staging table per
   school. Christina exports from Google Sheets, renames headers,
   and uploads via Supabase Table Editor → "Insert" → "Import data
   from CSV."

---

## CSV prep cheatsheet

You always rename headers to snake_case before upload, and you always
add a `school_code` and `import_run_id` column. Some tabs need
additional manual columns. Full reference:

### Teacher Roster

**Source headers (from Google Sheets):**
```
Teacher Name, Grade Assignment(s)
```

**Add these columns manually:**
- `import_run_id` — your run id (e.g. `cca-20260415`), same value on every row
- `school_code` — the school's short code (`CCA`, `GPA`, `APA`), same value on every row
- `email` — real email per teacher (REQUIRED, not in source — type it in)
- `role` — `tutor`, `coach`, or `school_admin` per teacher (optional, defaults to tutor)

**Final CSV header row (paste this over the existing header):**
```
import_run_id,school_code,teacher_name,email,grade_assignments,role
```

### Student Roster

**Source headers:**
```
Student Name, Grade, Teacher, Group
```

**Add these columns manually:**
- `import_run_id` — your run id
- `school_code` — `CCA`, `GPA`, or `APA`
- `student_number` — the school's SIS student ID (REQUIRED, not in source). If no SIS numbers exist, generate deterministic placeholders like `CCA-G3-001`, `CCA-G3-002`, etc.
- `enrollment_date_raw` — optional. If blank, defaults to FY26 start (2025-08-01).

**Final CSV header row:**
```
import_run_id,school_code,student_name,student_number,grade_raw,teacher_name,group_label,enrollment_date_raw
```

### Initial Assessment (UFLI Map format)

**Source format:** one row per student, columns are `Student Name`
plus 128 lesson columns labeled `L1` through `L128`. Cell values are
`Y`, `N`, `A`, or empty.

**Add these columns manually:**
- `import_run_id`
- `school_code`
- `assessment_date` — single date for the whole import (e.g. `2025-08-15`)

**Rename the lesson columns** from `L1, L2, ..., L128` to lowercase
`l1, l2, ..., l128`. This is a one-line find-and-replace in any text
editor: replace `L` with `l` in the header row only.

**Final CSV header row:**
```
import_run_id,school_code,student_name,assessment_date,l1,l2,l3,...,l128
```

(The 128 lesson columns are required even if they're mostly empty —
the staging table has a column for each.)

### Small Group Progress

**Source headers:**
```
Date, Group Name, Student Name, Lesson Number, Status
```

**Add these columns manually:**
- `import_run_id`
- `school_code`

**Final CSV header row:**
```
import_run_id,school_code,date_recorded_raw,group_label,student_name,lesson_number,status
```

---

## CCA full import workflow

CCA is the wipe-and-import case — the test seed populated CCA with
fake data that needs to be cleared first.

### Step 1: Wipe the test data

```sql
SELECT * FROM public.import_teardown_school('CCA');
```

You should see ~12 rows returned (one per live table that had data).
Each row shows `(live_table, rows_deleted)`. School + academic_year
rows are preserved; everything else is gone.

### Step 2: Upload teachers CSV

1. Open **Supabase dashboard → Table Editor → `staging_teachers`**
2. Click **Insert → Import data from CSV**
3. Select your prepared `cca_teachers.csv`
4. Verify the column mapping looks right (headers match)
5. Click **Save**

Verify the upload landed:
```sql
SELECT COUNT(*), MIN(transform_status), MAX(transform_status)
FROM public.staging_teachers
WHERE import_run_id = 'cca-20260415';
```
Expected: count = number of rows in your CSV, status = `pending`.

### Step 3: Run the teachers transform

```sql
SELECT * FROM public.import_teachers('cca-20260415', 'CCA');
```

Read the summary row carefully:
- **`imported`** — new staff rows created
- **`updated`** — staff rows that already existed and were updated
- **`skipped`** — should be 0 on first run
- **`errors`** — should be 0 ideally; if > 0, see Step 3a
- **`first_errors`** — first 10 error messages for quick diagnosis

#### Step 3a: Handle teacher errors (if any)

```sql
SELECT teacher_name, email, transform_error
FROM public.staging_teachers
WHERE import_run_id = 'cca-20260415'
  AND transform_status = 'error'
ORDER BY id;
```

Common errors:
- `missing email` → add the email to the staging row, reset to pending, re-run
- `invalid email format: foo` → fix the email value
- `could not parse teacher_name` → name field was blank or whitespace

To fix and re-process a single row:
```sql
UPDATE public.staging_teachers
SET email = 'jane.doe@cca.edu',
    transform_status = 'pending',
    transform_error = NULL
WHERE id = 42;  -- the staging row id from the SELECT above

SELECT * FROM public.import_teachers('cca-20260415', 'CCA');
-- The transform only touches rows still marked 'pending', so you
-- can re-run without affecting already-imported rows.
```

### Step 4: Upload students CSV

Same process as teachers: Table Editor → `staging_students` → Insert → Import data from CSV.

```sql
SELECT COUNT(*), transform_status
FROM public.staging_students
WHERE import_run_id = 'cca-20260415'
GROUP BY transform_status;
```

### Step 5: Run the students transform

```sql
SELECT * FROM public.import_students('cca-20260415', 'CCA');
```

Common errors are similar to teachers, plus:
- `unrecognized grade: foo` → check the grade_raw value matches one of: `KG`, `K`, `Kindergarten`, `1`, `G1`, `Grade 1`, `1st`, `First`, etc. through G8.
- `missing student_number` → add a value
- `could not parse student_name` → name field was blank

### Step 6: Build the groups by hand 🛑

**This is the manual step.** Open `/dashboard/groups` in the app and
create every group that appears in your historical data, with:
- The exact `group_name` that matches the `Group Name` column in
  your Small Group Progress CSV (case-sensitive!)
- The correct teacher assignment
- The correct grade
- The student roster (add students one at a time via the Roster tab)

**Why manual:** the legacy sheet structure doesn't reliably encode
group rosters in a machine-parseable way. Per the design doc Q3
(Option A), Christina builds the groups by hand so historical
lesson data can attribute correctly.

To get a list of group names you'll need to create, peek at your
Small Group Progress CSV's `Group Name` column and dedupe.

### Step 7: Upload initial assessments CSV

Same process: Table Editor → `staging_initial_assessments` → Insert → Import data from CSV.

### Step 8: Run the initial assessments transform

```sql
SELECT * FROM public.import_initial_assessments('cca-20260415', 'CCA');
```

Common errors:
- `no matching active student: Jane Doe` → either the student wasn't
  imported in Step 5, or the name in the assessment CSV doesn't
  exactly match (case/whitespace insensitive, but spelling matters)
- `ambiguous student match: Jane Doe` → two students have the same
  normalized name. Disambiguate by tweaking one student's record
  (add middle initial) and re-run.
- `could not parse assessment_date: foo` → use ISO format (`2025-08-15`)
  or US format (`08/15/2025`)

### Step 9: Upload historical lessons CSV

Same process: Table Editor → `staging_lesson_progress` → Insert → Import data from CSV.

### Step 10: Run the historical lessons transform

```sql
SELECT * FROM public.import_historical_lessons('cca-20260415', 'CCA');
```

This is the largest run — could be thousands of rows. Common errors:
- `no matching group (create it via /dashboard/groups first): G3 Group A`
  → Step 6 missed this group. Go create it, then re-run.
- `no matching active student: Foo Bar` → student name mismatch
- `date outside current year: 2024-09-01` → expected, per Q4 scope.
  These rows are rejected; nothing to fix unless you want to import
  more history (which we explicitly chose not to).

### Step 11: Compute snapshots + bands

After all four imports succeed, navigate to **`/dashboard/snapshots`**
in the app and click **"Recompute snapshots"**. This populates
`weekly_snapshots` and `band_assignments` from the freshly imported
`lesson_progress` rows. Without this step, the Big Four / Bands /
Highlights / Coaching pages will be empty.

### Step 12: Spot-check the imported data

```sql
-- Counts per live table
SELECT 'staff' AS t, COUNT(*) FROM public.staff WHERE school_id = (SELECT school_id FROM public.schools WHERE short_code = 'CCA')
UNION ALL SELECT 'students', COUNT(*) FROM public.students WHERE school_id = (SELECT school_id FROM public.schools WHERE short_code = 'CCA')
UNION ALL SELECT 'instructional_groups', COUNT(*) FROM public.instructional_groups WHERE school_id = (SELECT school_id FROM public.schools WHERE short_code = 'CCA')
UNION ALL SELECT 'initial_assessments', COUNT(*) FROM public.initial_assessments ia JOIN public.students s USING (student_id) WHERE s.school_id = (SELECT school_id FROM public.schools WHERE short_code = 'CCA')
UNION ALL SELECT 'lesson_progress', COUNT(*) FROM public.lesson_progress lp JOIN public.students s USING (student_id) WHERE s.school_id = (SELECT school_id FROM public.schools WHERE short_code = 'CCA');
```

Then open the app:
- **Switch active school to CCA** via the school switcher (top right)
- **`/dashboard`** — Big Four cards should show real numbers
- **`/dashboard/students`** — every imported student should appear
- **`/dashboard/staff`** — every imported teacher
- **`/dashboard/groups`** — the groups you built by hand in Step 6
- **`/dashboard/bands`** — band distribution from imported initial assessments
- Pick one student → student detail page should show the imported baseline + lesson_progress

---

## GPA full import workflow

Same as CCA except **skip Step 1** (no teardown — GPA was created
fresh by migration 00011 and has no test data).

Use run id `gpa-20260415` (or whatever date you're running on).

---

## APA initial-assessments-only workflow

APA is the smallest school. Per Q1d.2, Christina builds APA's staff,
students, and groups by hand through the UI. Only the initial
assessment data gets imported.

### Step 1: Build APA by hand

Open `/dashboard` and switch the active school to APA. Then:
1. **`/dashboard/staff`** — add each APA teacher (CTRL-D to duplicate fields if helpful)
2. **`/dashboard/students`** — add each APA student
3. **`/dashboard/groups`** — create groups, assign teachers, add students to rosters

### Step 2: Upload initial assessments CSV

Prep the CSV per the cheatsheet above (with `school_code = 'APA'`
on every row).

Upload via Table Editor → `staging_initial_assessments` → Insert → Import data from CSV.

### Step 3: Run the transform

```sql
SELECT * FROM public.import_initial_assessments('apa-20260415', 'APA');
```

Same error patterns as CCA Step 8.

### Step 4: Recompute snapshots

`/dashboard/snapshots` → "Recompute snapshots."

### Step 5: Spot-check

Same as CCA Step 12, scoped to APA.

---

## Common troubleshooting

### "Function does not exist"

You haven't applied the migration that creates that function. Apply
00011, 00012, 00013, 00014 in order. The verification query at the
top of this doc tells you what's already in place.

### "no matching active student"

Two possibilities:
1. **The student wasn't imported.** Check `staging_students` for the
   import_run_id and look for an `error` status row matching that
   name.
2. **The names don't match.** Matching is case-insensitive but
   whitespace-sensitive. "John  Smith" (two spaces) won't match
   "John Smith". Standardize spacing in both source files before
   re-uploading.

### "ambiguous student match"

Two students at the same school have the same first + last name
(case-insensitive). Three options:
1. Add a middle name to one of them in the live `students` table
2. Update the source CSV to add disambiguation (rare — usually
   the source isn't the problem)
3. Edit the staging row's `student_name` to add a middle initial,
   then re-run

### "no matching group (create it via /dashboard/groups first)"

You missed creating that group in Step 6 of the CCA workflow.
Open `/dashboard/groups`, create it with the exact name from the
error message, assign students, then re-run `import_historical_lessons`.

### "date outside current year"

Per Q4, only current-year (FY26) data is imported. This is intentional;
historical data from prior years is rejected.

### "duplicate key value violates unique constraint" on student_number

Two staging rows have the same `student_number`. Each student needs
a unique number. If you used placeholder numbers (`CCA-G3-001` etc.),
make sure they're sequential and unique within the school.

### A row is stuck in 'error' status — how do I retry it?

After fixing the underlying problem (e.g. correcting a name in
the staging row), reset its status:

```sql
UPDATE public.staging_<table>
SET transform_status = 'pending',
    transform_error = NULL
WHERE id = <staging row id>;

-- then re-run the transform
SELECT * FROM public.import_<transform>('<run_id>', '<school_code>');
```

The transform only processes rows in `pending` status, so already-
imported rows are untouched.

### I want to start over for one school

```sql
SELECT * FROM public.import_teardown_school('CCA');
```

Wipes all live-table rows scoped to CCA in dependency order. Schools,
academic_years, and staging tables are preserved. You can then re-run
the full workflow from Step 2 (or fix your CSVs and start with a
fresh upload).

### How do I clean up staging rows after a successful import?

Optional — staging rows persist as an audit trail. To wipe them:

```sql
DELETE FROM public.staging_lesson_progress     WHERE import_run_id = 'cca-20260415';
DELETE FROM public.staging_initial_assessments WHERE import_run_id = 'cca-20260415';
DELETE FROM public.staging_students            WHERE import_run_id = 'cca-20260415';
DELETE FROM public.staging_teachers            WHERE import_run_id = 'cca-20260415';
```

---

## Recommended order for the pilot rollout

1. **GPA first** — fresh school, no teardown step, fewest moving parts
2. **CCA second** — wipe-and-import case, validates the teardown helper
3. **APA last** — initial-assessments-only, validates the standalone path

After all three are imported successfully and spot-checks look right,
the import pipeline has earned its keep and we can move on to the
auth claim flow (so teachers can actually log in) and the rest of
Phase D / Phase E.
