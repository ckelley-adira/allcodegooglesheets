# Gateway Logic Testing — Quick Start Guide

This is a quick reference for running the E2E tests. See `GATEWAY_E2E_TEST.md` for full details.

## Before You Start

- [ ] You have a test Supabase project (or use a branch)
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables are set
- [ ] Current schema is deployed to test database

## Run Tests

**Jest (full test suite):**
```bash
npm test __tests__/gateway-e2e.test.ts
```

**Manual test (standalone):**
```bash
npx ts-node docs/GATEWAY_MANUAL_TEST.ts
```

## Expected Output

```
✓ Coaching snapshot includes 'Assign Gateway Reviews' priority item
✓ insertGatewayLessonsToSequence appends 2 review lessons
✓ Second call is idempotent (inserts 0)
✓ Gateway lessons have correct sort_order
✓ Section with no reviews throws error
✓ Group with no active sequence throws error

Tests: 6 passed
```

## One-Minute Manual Setup

The test harness (`GATEWAY_MANUAL_TEST.ts`) will automatically look for test data created by `GATEWAY_E2E_TEST.md` setup SQL.

1. **Run the setup SQL from `GATEWAY_E2E_TEST.md`** against test Supabase project:
   - Creates group "Digraphs Gateway Test Group"
   - Creates two students (Gateway Student1, Gateway Student2)
   - Creates progress rows showing 70% Digraphs mastery (below 80% threshold)
   - Creates active instructional sequence for the group

2. **Run the test:**
   ```bash
   npx ts-node docs/GATEWAY_MANUAL_TEST.ts
   ```

3. **The script will:**
   - Lookup test data automatically
   - Call `getCoachingSnapshot()` and verify priority item appears
   - Call `insertGatewayLessonsToSequence()` and verify 2 lessons inserted
   - Call again and verify idempotency (0 inserted)
   - Report results

## Verify Manually (UI)

After tests pass, verify in the app:

1. **Open Coaching Dashboard**
   - Expect: "Assign Gateway Reviews" item for "Digraphs Gateway Test Group"
   - Detail: "Digraphs completed at 70% — 2 gateway reviews available"

2. **Open Group Sequence Page** for the test group
   - Expect: L49 and L53 at end with status="upcoming"

3. **Open Student Detail Page** for Gateway Student1 or Student2
   - Digraphs mastery should show 70% (non-review calculation)
   - Mark L49 and L53 as Y in a session
   - Re-check: Digraphs mastery should jump to 100% (gateway passed)

## Cleanup

Remove test data when done:

```sql
DELETE FROM instructional_sequence_lessons 
WHERE sequence_id IN (
  SELECT sequence_id FROM instructional_sequences 
  WHERE group_id IN (
    SELECT group_id FROM instructional_groups 
    WHERE group_name LIKE 'Digraphs Gateway%'
  )
);

DELETE FROM instructional_sequences 
WHERE group_id IN (SELECT group_id FROM instructional_groups WHERE group_name LIKE 'Digraphs Gateway%');

DELETE FROM group_memberships 
WHERE group_id IN (SELECT group_id FROM instructional_groups WHERE group_name LIKE 'Digraphs Gateway%');

DELETE FROM lesson_progress 
WHERE student_id IN (SELECT student_id FROM students WHERE first_name='Gateway');

DELETE FROM instructional_groups WHERE group_name LIKE 'Digraphs Gateway%';

DELETE FROM students WHERE first_name='Gateway';
```

---

## Full Documentation

- **`GATEWAY_E2E_TEST.md`** — Complete test setup, Jest tests, verification checklist
- **`GATEWAY_MANUAL_TEST.ts`** — Standalone test harness source
- **`GATEWAY_IMPLEMENTATION_SUMMARY.md`** — Architecture, data flow, verification checklist
