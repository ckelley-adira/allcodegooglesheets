/**
 * Manual test harness for gateway logic E2E
 *
 * Run with: npx ts-node docs/GATEWAY_MANUAL_TEST.ts
 *
 * This script directly tests the three critical paths:
 * 1. Coaching snapshot includes "Assign Gateway Reviews" priority
 * 2. insertGatewayLessonsToSequence() appends lessons correctly
 * 3. Idempotency check (second call inserts nothing)
 */

import { getCoachingSnapshot } from "../web/src/lib/dal/coaching";
import { insertGatewayLessonsToSequence } from "../web/src/lib/dal/sequences";
import { createClient } from "../web/src/lib/supabase/server";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, any>;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`  ${msg}`);
}

function logSection(title: string) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(70)}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  logSection("GATEWAY LOGIC E2E TEST");

  const SCHOOL_ID = 1;
  const YEAR_ID = 1;
  const GROUP_NAME = "Digraphs Gateway Test Group";
  const SECTION_NAME = "Digraphs";

  let groupId: number | null = null;
  let sequenceId: number | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1: Setup
  // ─────────────────────────────────────────────────────────────────────────

  logSection("Phase 1: Finding Test Data");

  await test("Find test group 'Digraphs Gateway Test Group'", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("instructional_groups")
      .select("group_id")
      .eq("school_id", SCHOOL_ID)
      .eq("group_name", GROUP_NAME)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error(
        `Test group "${GROUP_NAME}" not found. Run GATEWAY_E2E_TEST.md setup SQL first.`
      );
    }
    groupId = data.group_id;
    log(`Found group_id = ${groupId}`);
  });

  await test("Find active sequence for test group", async () => {
    if (!groupId) throw new Error("groupId not set");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("instructional_sequences")
      .select("sequence_id")
      .eq("group_id", groupId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error(`No active sequence found for group ${groupId}`);
    }
    sequenceId = data.sequence_id;
    log(`Found sequence_id = ${sequenceId}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2: Coaching Snapshot
  // ─────────────────────────────────────────────────────────────────────────

  logSection("Phase 2: Coaching Snapshot");

  let coachingSnapshot: Awaited<ReturnType<typeof getCoachingSnapshot>> | null =
    null;

  await test(
    "getCoachingSnapshot() returns without error",
    async () => {
      coachingSnapshot = await getCoachingSnapshot(SCHOOL_ID, YEAR_ID);
      log(`Snapshot contains ${coachingSnapshot.priorities.length} priority items`);
    }
  );

  await test(
    "Snapshot includes 'Assign Gateway Reviews' priority item",
    async () => {
      if (!coachingSnapshot) throw new Error("Snapshot not loaded");
      if (!groupId) throw new Error("groupId not set");

      const item = coachingSnapshot.priorities.find(
        (p) =>
          p.groupId === groupId && p.label === "Assign Gateway Reviews"
      );

      if (!item) {
        // Debug: show what we found for this group
        const groupItems = coachingSnapshot.priorities.filter(
          (p) => p.groupId === groupId
        );
        throw new Error(
          `"Assign Gateway Reviews" item not found. Found ${groupItems.length} items for group:\n${groupItems
            .map((p) => `  - ${p.label}`)
            .join("\n")}`
        );
      }

      log(`✓ Found item: "${item.label}"`);
      log(`  Detail: ${item.detail}`);
      log(`  Action: ${item.action}`);
      log(`  Urgency: ${item.urgency}`);
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 3: Insert Gateway Lessons
  // ─────────────────────────────────────────────────────────────────────────

  logSection("Phase 3: Insert Gateway Lessons");

  let insertResult: Awaited<
    ReturnType<typeof insertGatewayLessonsToSequence>
  > | null = null;

  await test(
    "insertGatewayLessonsToSequence() inserts 2 review lessons",
    async () => {
      if (!groupId) throw new Error("groupId not set");
      insertResult = await insertGatewayLessonsToSequence(
        groupId,
        SECTION_NAME as any
      );

      if (insertResult.inserted !== 2) {
        throw new Error(
          `Expected 2 lessons inserted, got ${insertResult.inserted}`
        );
      }
      if (insertResult.lessonNumbers.length !== 2) {
        throw new Error(
          `Expected 2 lesson numbers, got ${insertResult.lessonNumbers.length}`
        );
      }

      log(`Inserted ${insertResult.inserted} lessons`);
      log(`  Lesson numbers: ${insertResult.lessonNumbers.join(", ")}`);
    }
  );

  await test(
    "Inserted lessons are in sequence with status='upcoming'",
    async () => {
      if (!sequenceId) throw new Error("sequenceId not set");
      if (!insertResult) throw new Error("insertResult not set");

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("instructional_sequence_lessons")
        .select(
          "sort_order, status, ufli_lessons(lesson_number, is_review)"
        )
        .eq("sequence_id", sequenceId)
        .in("ufli_lessons.lesson_number", insertResult.lessonNumbers)
        .order("sort_order");

      if (error) throw error;
      if (!data || data.length !== 2) {
        throw new Error(
          `Expected 2 sequence lessons, found ${data?.length ?? 0}`
        );
      }

      data.forEach((lesson: any, idx: number) => {
        log(
          `  Lesson L${lesson.ufli_lessons.lesson_number}: sort_order=${lesson.sort_order}, status=${lesson.status}, is_review=${lesson.ufli_lessons.is_review}`
        );
        if (lesson.status !== "upcoming") {
          throw new Error(
            `Lesson ${idx} has status '${lesson.status}', expected 'upcoming'`
          );
        }
        if (!lesson.ufli_lessons.is_review) {
          throw new Error(
            `Lesson ${idx} has is_review=false, expected true`
          );
        }
      });
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Idempotency
  // ─────────────────────────────────────────────────────────────────────────

  logSection("Phase 4: Idempotency Check");

  let insertResult2: Awaited<
    ReturnType<typeof insertGatewayLessonsToSequence>
  > | null = null;

  await test("Second call to insertGatewayLessonsToSequence() inserts 0", async () => {
    if (!groupId) throw new Error("groupId not set");
    insertResult2 = await insertGatewayLessonsToSequence(
      groupId,
      SECTION_NAME as any
    );

    if (insertResult2.inserted !== 0) {
      throw new Error(
        `Expected 0 lessons inserted on second call, got ${insertResult2.inserted}`
      );
    }
    log(`Second call inserted ${insertResult2.inserted} lessons (correct)`);
  });

  await test(
    "Sequence still has exactly 2 gateway lessons (no duplication)",
    async () => {
      if (!sequenceId) throw new Error("sequenceId not set");

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("instructional_sequence_lessons")
        .select("lesson_id")
        .eq("sequence_id", sequenceId)
        .in("ufli_lessons.lesson_number", [49, 53]);

      if (error) throw error;
      if (!data || data.length !== 2) {
        throw new Error(
          `Expected 2 gateway lessons in sequence, found ${data?.length ?? 0}`
        );
      }
      log(`Sequence contains exactly 2 gateway lessons`);
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────

  logSection("Test Summary");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((r) => {
    const icon = r.passed ? "✓" : "✗";
    console.log(`  ${icon} ${r.name}`);
    if (r.error) {
      console.log(`    ${r.error}`);
    }
  });

  console.log(`\n  Total: ${passed} passed, ${failed} failed out of ${results.length}`);

  if (failed === 0) {
    console.log("\n  🎉 All tests passed!\n");
    process.exit(0);
  } else {
    console.log("\n  ❌ Some tests failed.\n");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(2);
});
