# Gateway Logic End-to-End Test

This document describes a complete end-to-end test for the gateway review logic implementation. It covers:
1. Setting up test data (group, students, progress rows)
2. Verifying the "Assign Gateway Reviews" priority item appears
3. Testing the `insertGatewayLessonsToSequence()` function

## Test Scenario

**Group:** "Digraphs Group" (a small group working on the Digraphs section)
**Section:** Digraphs (lessons 43-54)
**Gateway Reviews for Digraphs:** L49, L53
**Status:** Group completed Digraphs at 70% mastery (below 80% threshold)

### Expected Outcomes

1. **Coaching snapshot includes "Assign Gateway Reviews" priority item** because:
   - Group has `completedPrevSection = "Digraphs"`
   - `prevSectionMasteryPct = 70` (< 80)
   - `SECTION_REVIEW_LESSONS["Digraphs"]` has 2 lessons available

2. **insertGatewayLessonsToSequence() appends review lessons** to the active sequence as "upcoming" status

3. **Idempotency check:** calling `insertGatewayLessonsToSequence()` a second time inserts 0 lessons

---

## Setup SQL

Run this SQL against a test Supabase project to create the test scenario:

```sql
-- Assumes school_id=1, year_id=1 exist in test database
-- This SQL creates one group with two students in Digraphs section

-- 1. Create the test group
INSERT INTO instructional_groups (school_id, group_name, is_active)
VALUES (1, 'Digraphs Gateway Test Group', true)
RETURNING group_id AS group_id_for_reference;
-- (Note the group_id returned; substitute in steps below as {GROUP_ID})

-- 2. Create two test students (if not already existing)
INSERT INTO students (school_id, first_name, last_name, grade_id, enrollment_status)
SELECT 1, 'Gateway', 'Student1', grade_id, 'active'
FROM grade_levels WHERE name = 'G1'
ON CONFLICT DO NOTHING;

INSERT INTO students (school_id, first_name, last_name, grade_id, enrollment_status)
SELECT 1, 'Gateway', 'Student2', grade_id, 'active'
FROM grade_levels WHERE name = 'G1'
ON CONFLICT DO NOTHING;

-- 3. Add students to the group
INSERT INTO group_memberships (group_id, student_id, is_active)
SELECT {GROUP_ID}, student_id, true
FROM students
WHERE school_id = 1
  AND first_name = 'Gateway'
  AND (last_name = 'Student1' OR last_name = 'Student2');

-- 4. Create progress records showing:
--    - Both students have passed most Digraphs regular lessons
--    - Neither has passed the gateway review lessons yet
--    - Last attempted lesson is L54 (end of Digraphs)

-- Student 1: Passed L43-L48 (6/8 = 75% of non-review Digraphs)
INSERT INTO lesson_progress (student_id, year_id, group_id, lesson_id, status, date_recorded)
SELECT
  s.student_id,
  1,
  {GROUP_ID},
  ul.lesson_id,
  'Y',
  '2026-04-01'::date
FROM students s
CROSS JOIN ufli_lessons ul
WHERE s.school_id = 1 AND s.first_name = 'Gateway' AND s.last_name = 'Student1'
  AND ul.lesson_number BETWEEN 43 AND 48;

-- Student 1: Attempted but failed L49 (gateway lesson)
INSERT INTO lesson_progress (student_id, year_id, group_id, lesson_id, status, date_recorded)
SELECT
  s.student_id,
  1,
  {GROUP_ID},
  ul.lesson_id,
  'N',
  '2026-04-02'::date
FROM students s
CROSS JOIN ufli_lessons ul
WHERE s.school_id = 1 AND s.first_name = 'Gateway' AND s.last_name = 'Student1'
  AND ul.lesson_number = 49;

-- Student 1: Recent activity in L54 (last lesson of Digraphs)
INSERT INTO lesson_progress (student_id, year_id, group_id, lesson_id, status, date_recorded)
SELECT
  s.student_id,
  1,
  {GROUP_ID},
  ul.lesson_id,
  'Y',
  '2026-04-05'::date
FROM students s
CROSS JOIN ufli_lessons ul
WHERE s.school_id = 1 AND s.first_name = 'Gateway' AND s.last_name = 'Student1'
  AND ul.lesson_number = 54;

-- Student 2: Passed L43-L48, attempted L49 (N), L54 (Y)
INSERT INTO lesson_progress (student_id, year_id, group_id, lesson_id, status, date_recorded)
SELECT
  s.student_id,
  1,
  {GROUP_ID},
  ul.lesson_id,
  'Y',
  '2026-04-01'::date
FROM students s
CROSS JOIN ufli_lessons ul
WHERE s.school_id = 1 AND s.first_name = 'Gateway' AND s.last_name = 'Student2'
  AND ul.lesson_number BETWEEN 43 AND 48;

INSERT INTO lesson_progress (student_id, year_id, group_id, lesson_id, status, date_recorded)
SELECT
  s.student_id,
  1,
  {GROUP_ID},
  ul.lesson_id,
  'N',
  '2026-04-02'::date
FROM students s
CROSS JOIN ufli_lessons ul
WHERE s.school_id = 1 AND s.first_name = 'Gateway' AND s.last_name = 'Student2'
  AND ul.lesson_number = 49;

INSERT INTO lesson_progress (student_id, year_id, group_id, lesson_id, status, date_recorded)
SELECT
  s.student_id,
  1,
  {GROUP_ID},
  ul.lesson_id,
  'Y',
  '2026-04-05'::date
FROM students s
CROSS JOIN ufli_lessons ul
WHERE s.school_id = 1 AND s.first_name = 'Gateway' AND s.last_name = 'Student2'
  AND ul.lesson_number = 54;

-- 5. Create an active instructional sequence for this group
INSERT INTO instructional_sequences (group_id, year_id, name, status, created_at)
VALUES ({GROUP_ID}, 1, 'Digraphs Gateway Sequence', 'active', now())
RETURNING sequence_id AS seq_id_for_reference;
-- (Note the sequence_id returned; substitute in test code as {SEQUENCE_ID})

-- 6. Add the current Digraphs lessons to the sequence (non-review lessons only)
INSERT INTO instructional_sequence_lessons (sequence_id, lesson_id, sort_order, status)
SELECT
  {SEQUENCE_ID},
  ul.lesson_id,
  row_number() OVER (ORDER BY ul.lesson_number),
  CASE
    WHEN ul.lesson_number = 43 THEN 'current'::instructional_sequence_lesson_status
    ELSE 'upcoming'::instructional_sequence_lesson_status
  END
FROM ufli_lessons ul
WHERE ul.lesson_number BETWEEN 43 AND 54
  AND NOT ul.is_review
ORDER BY ul.lesson_number;
```

---

## Test Code (TypeScript)

Create this test file and run it against your test Supabase instance:

```typescript
// __tests__/gateway-e2e.test.ts

import { getCoachingSnapshot } from "@/lib/dal/coaching";
import { insertGatewayLessonsToSequence } from "@/lib/dal/sequences";
import { createClient } from "@/lib/supabase/server";

describe("Gateway Logic E2E", () => {
  const SCHOOL_ID = 1;
  const YEAR_ID = 1;
  const GROUP_NAME = "Digraphs Gateway Test Group";
  const SECTION_NAME = "Digraphs";

  let groupId: number;
  let sequenceId: number;

  beforeAll(async () => {
    // Lookup the test group and sequence from setup SQL
    const supabase = await createClient();
    
    const { data: groupData } = await supabase
      .from("instructional_groups")
      .select("group_id")
      .eq("school_id", SCHOOL_ID)
      .eq("group_name", GROUP_NAME)
      .single();
    
    if (!groupData) throw new Error("Test group not found. Run setup SQL first.");
    groupId = groupData.group_id;

    const { data: seqData } = await supabase
      .from("instructional_sequences")
      .select("sequence_id")
      .eq("group_id", groupId)
      .eq("status", "active")
      .single();
    
    if (!seqData) throw new Error("Test sequence not found. Run setup SQL first.");
    sequenceId = seqData.sequence_id;
  });

  test("Coaching snapshot includes 'Assign Gateway Reviews' priority item", async () => {
    const snapshot = await getCoachingSnapshot(SCHOOL_ID, YEAR_ID);

    // Find the priority item for our test group
    const gatewayItem = snapshot.priorities.find(
      (p) =>
        p.groupId === groupId &&
        p.label === "Assign Gateway Reviews"
    );

    expect(gatewayItem).toBeDefined();
    expect(gatewayItem?.detail).toContain("Digraphs");
    expect(gatewayItem?.detail).toContain("70%"); // Weak mastery
    expect(gatewayItem?.detail).toContain("2 gateway reviews"); // L49, L53
  });

  test("insertGatewayLessonsToSequence appends review lessons", async () => {
    const result = await insertGatewayLessonsToSequence(groupId, SECTION_NAME);

    expect(result.inserted).toBe(2); // L49, L53
    expect(result.lessonNumbers).toEqual([49, 53]);

    // Verify they were actually inserted into the sequence
    const supabase = await createClient();
    const { data: lessons } = await supabase
      .from("instructional_sequence_lessons")
      .select(
        "lesson_id, sort_order, status, ufli_lessons(lesson_number, is_review)"
      )
      .eq("sequence_id", sequenceId)
      .in("ufli_lessons.lesson_number", [49, 53])
      .order("sort_order");

    expect(lessons).toHaveLength(2);
    expect(lessons[0].status).toBe("upcoming");
    expect(lessons[1].status).toBe("upcoming");
    expect((lessons[0].ufli_lessons as any).is_review).toBe(true);
  });

  test("insertGatewayLessonsToSequence is idempotent", async () => {
    // Call again — should insert 0 lessons
    const result2 = await insertGatewayLessonsToSequence(groupId, SECTION_NAME);

    expect(result2.inserted).toBe(0);
    expect(result2.lessonNumbers).toHaveLength(0);

    // Verify sequence still has exactly 2 gateway lessons (not duplicated)
    const supabase = await createClient();
    const { data: lessons } = await supabase
      .from("instructional_sequence_lessons")
      .select("lesson_id")
      .eq("sequence_id", sequenceId)
      .in("ufli_lessons.lesson_number", [49, 53]);

    expect(lessons).toHaveLength(2); // Still 2, not 4
  });

  test("Gateway lessons have higher sort_order than current lessons", async () => {
    const supabase = await createClient();
    const { data: allLessons } = await supabase
      .from("instructional_sequence_lessons")
      .select("sort_order, ufli_lessons(lesson_number, is_review)")
      .eq("sequence_id", sequenceId)
      .order("sort_order");

    const regularLessons = allLessons.filter(
      (l: any) => !l.ufli_lessons.is_review
    );
    const gatewayLessons = allLessons.filter(
      (l: any) => l.ufli_lessons.is_review
    );

    expect(gatewayLessons.length).toBe(2);
    
    // Gateway lessons should come after all regular lessons in sort order
    const maxRegularSort = Math.max(...regularLessons.map((l: any) => l.sort_order));
    const minGatewaySort = Math.min(...gatewayLessons.map((l: any) => l.sort_order));
    
    expect(minGatewaySort).toBeGreaterThan(maxRegularSort);
  });

  test("Section with no reviews throws error", async () => {
    const noReviewSection = "Blends"; // Has no review lessons
    
    await expect(
      insertGatewayLessonsToSequence(groupId, noReviewSection)
    ).rejects.toThrow(/no review/i);
  });

  test("Group with no active sequence throws error", async () => {
    // Create a second test group with no sequence
    const supabase = await createClient();
    const { data: newGroup } = await supabase
      .from("instructional_groups")
      .insert({ school_id: SCHOOL_ID, group_name: "No Sequence Group", is_active: true })
      .select()
      .single();
    
    await expect(
      insertGatewayLessonsToSequence(newGroup.group_id, SECTION_NAME)
    ).rejects.toThrow(/no active.*sequence/i);

    // Cleanup
    await supabase
      .from("instructional_groups")
      .delete()
      .eq("group_id", newGroup.group_id);
  });
});
```

---

## Running the Test

### Prerequisites
- A test Supabase project (or branch) with current schema
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables set

### Steps

1. **Run the setup SQL** against your test database:
   ```bash
   # Extract {GROUP_ID} and {SEQUENCE_ID} from the output
   supabase db push  # Or run the SQL directly
   ```

2. **Substitute the IDs** in the test if needed (the `beforeAll` hook will find them)

3. **Run the test:**
   ```bash
   npm test __tests__/gateway-e2e.test.ts
   ```

### Expected Output

```
PASS  __tests__/gateway-e2e.test.ts
  Gateway Logic E2E
    ✓ Coaching snapshot includes 'Assign Gateway Reviews' priority item (245ms)
    ✓ insertGatewayLessonsToSequence appends review lessons (183ms)
    ✓ insertGatewayLessonsToSequence is idempotent (156ms)
    ✓ Gateway lessons have higher sort_order than current lessons (124ms)
    ✓ Section with no reviews throws error (89ms)
    ✓ Group with no active sequence throws error (201ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

---

## Verification Checklist

After the test passes, verify these properties manually:

- [ ] **Coaching Dashboard** shows the "Assign Gateway Reviews" priority item for Digraphs Gateway Test Group
- [ ] **Group Sequence Page** displays the gateway lessons (L49, L53) at the end of the sequence as "upcoming"
- [ ] **Gateway lessons are marked `is_review = true`** in the sequence view
- [ ] **Calling the function again** (via API or directly) does not duplicate lessons
- [ ] **Student Detail Page** for students in this group shows **100% mastery in Digraphs if they pass both L49 AND L53**, or falls back to non-review % otherwise
- [ ] **Band Assignment** for this group reflects ceiling section correctly (does not jump to next section due to gateway alone)

---

## Cleanup

After testing, remove test data:

```sql
DELETE FROM instructional_sequence_lessons WHERE sequence_id IN (
  SELECT sequence_id FROM instructional_sequences 
  WHERE group_id IN (
    SELECT group_id FROM instructional_groups 
    WHERE school_id = 1 AND group_name LIKE 'Digraphs Gateway%'
  )
);

DELETE FROM instructional_sequences
WHERE group_id IN (
  SELECT group_id FROM instructional_groups 
  WHERE school_id = 1 AND group_name LIKE 'Digraphs Gateway%'
);

DELETE FROM group_memberships
WHERE group_id IN (
  SELECT group_id FROM instructional_groups 
  WHERE school_id = 1 AND group_name LIKE 'Digraphs Gateway%'
);

DELETE FROM lesson_progress
WHERE student_id IN (
  SELECT student_id FROM students
  WHERE school_id = 1 AND first_name = 'Gateway'
)
AND year_id = 1;

DELETE FROM instructional_groups
WHERE school_id = 1 AND group_name LIKE 'Digraphs Gateway%';

DELETE FROM students
WHERE school_id = 1 AND first_name = 'Gateway';
```
