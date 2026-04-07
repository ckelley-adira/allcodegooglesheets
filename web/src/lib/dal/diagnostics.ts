/**
 * @file dal/diagnostics.ts — Diagnostic Error Analysis rollup
 *
 * Powers the /dashboard/diagnostics page. Aggregates two signal sources
 * into skill-section-scoped rollups, then joins the UFLI Diagnostic Error
 * Analysis Framework to each section so the view can show "likely
 * deficit + suggested response" alongside the raw counts:
 *
 *   1. lesson_progress with status='N'  — which sections have the most
 *      non-mastery results in the lookback window, how many students,
 *      how many distinct lessons.
 *
 *   2. assessment_component_errors      — which words were missed most
 *      and which specific components within those words. This is the
 *      finest-grained diagnostic detail we have: it tells us not just
 *      "VCe is weak" but "students are failing the vowel team, not the
 *      final silent e".
 *
 * Scoping: TILT Admins can request a network-wide rollup (schoolId=null),
 * or a specific school. School-scoped users always get their own school
 * (the caller enforces that via getActiveSchoolId).
 */

import { createClient } from "@/lib/supabase/server";
import {
  sectionForLesson,
  type SkillSectionName,
} from "@/lib/curriculum/sections";

// ── Types ────────────────────────────────────────────────────────────────

export interface SectionErrorRow {
  section: SkillSectionName;
  /** Distinct student count with at least one N in this section */
  studentCount: number;
  /** Total N rows in this section */
  nCount: number;
  /** Distinct lesson numbers where at least one N occurred */
  lessonCount: number;
  /** Total Y + N in the section, across all students */
  attemptCount: number;
  /** N / (Y+N) — accuracy inverse; higher = more errors */
  errorRatePct: number | null;
}

export interface MissedWordRow {
  sectionKey: string;
  sectionName: string;
  word: string;
  /** Times this word was missed by at least one component */
  missedCount: number;
  /** Distinct students who missed this word */
  studentCount: number;
  /** Frequency map of the missed components (lowercased) */
  missedComponents: Array<{ component: string; count: number }>;
}

export interface DiagnosticsRollup {
  /** Lookback window for the lesson_progress rollup, in days */
  windowDays: number;
  /** Total active students in scope (for denominators) */
  totalActiveStudents: number;
  /** Per-section rollup sorted by nCount desc */
  sections: SectionErrorRow[];
  /** Top missed words from assessment_component_errors, sorted by missedCount desc */
  topMissedWords: MissedWordRow[];
}

interface GetDiagnosticsOptions {
  /**
   * school_id to scope to, or null for the full network rollup.
   * null is only valid when the caller is a TILT Admin — enforce in the page.
   */
  schoolId: number | null;
  /** Lookback window in days for lesson_progress (default 28) */
  windowDays?: number;
  /** Max missed-word rows to return (default 25) */
  topWordsLimit?: number;
}

// ── Main composer ────────────────────────────────────────────────────────

export async function getDiagnosticsRollup(
  options: GetDiagnosticsOptions,
): Promise<DiagnosticsRollup> {
  const supabase = await createClient();
  const windowDays = options.windowDays ?? 28;
  const topWordsLimit = options.topWordsLimit ?? 25;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartIso = windowStart.toISOString().split("T")[0];

  // ── 1. Scope: student ids in scope ────────────────────────────────────
  // We need the set of student ids because:
  //   - lesson_progress has student_id but not school_id; we scope by
  //     intersecting with the school's students
  //   - assessment_component_errors is school-agnostic at the row level;
  //     we scope by intersecting with in-scope assessments
  // For a null schoolId (TILT network), we skip the scope filter.

  let studentIds: number[] | null = null;
  let totalActiveStudents = 0;

  if (options.schoolId !== null) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("student_id")
      .eq("school_id", options.schoolId)
      .eq("enrollment_status", "active");
    studentIds = (studentRows ?? []).map((r) => (r as { student_id: number }).student_id);
    totalActiveStudents = studentIds.length;
  } else {
    const { count } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("enrollment_status", "active");
    totalActiveStudents = count ?? 0;
  }

  // ── 2. lesson_progress in the window ──────────────────────────────────
  let progressQuery = supabase
    .from("lesson_progress")
    .select("student_id, status, ufli_lessons!inner(lesson_number, is_review)")
    .in("status", ["Y", "N"])
    .gte("date_recorded", windowStartIso);

  if (studentIds !== null) {
    if (studentIds.length === 0) {
      return {
        windowDays,
        totalActiveStudents: 0,
        sections: [],
        topMissedWords: [],
      };
    }
    progressQuery = progressQuery.in("student_id", studentIds);
  }

  const { data: progressRows } = await progressQuery;

  // Aggregate per section
  const sectionAgg = new Map<
    SkillSectionName,
    {
      students: Set<number>;
      nCount: number;
      yCount: number;
      lessons: Set<number>;
    }
  >();

  for (const row of progressRows ?? []) {
    const r = row as unknown as {
      student_id: number;
      status: "Y" | "N";
      ufli_lessons: { lesson_number: number; is_review: boolean } | null;
    };
    const lessonNumber = r.ufli_lessons?.lesson_number;
    if (!lessonNumber) continue;
    if (r.ufli_lessons?.is_review) continue;
    const section = sectionForLesson(lessonNumber);
    if (!section) continue;

    const agg = sectionAgg.get(section) ?? {
      students: new Set<number>(),
      nCount: 0,
      yCount: 0,
      lessons: new Set<number>(),
    };
    if (r.status === "N") {
      agg.nCount++;
      agg.students.add(r.student_id);
      agg.lessons.add(lessonNumber);
    } else {
      agg.yCount++;
    }
    sectionAgg.set(section, agg);
  }

  const sections: SectionErrorRow[] = [];
  for (const [section, agg] of sectionAgg.entries()) {
    if (agg.nCount === 0) continue;
    const attemptCount = agg.yCount + agg.nCount;
    sections.push({
      section,
      studentCount: agg.students.size,
      nCount: agg.nCount,
      lessonCount: agg.lessons.size,
      attemptCount,
      errorRatePct:
        attemptCount > 0 ? (agg.nCount / attemptCount) * 100 : null,
    });
  }
  sections.sort((a, b) => b.nCount - a.nCount);

  // ── 3. assessment_component_errors ────────────────────────────────────
  // Pull rows in scope. We need to join back to initial_assessments so we
  // can filter by the student's school_id.
  //
  // Shape: component_errors.assessment_id → initial_assessments.student_id
  //        → students.school_id
  const { data: componentErrorRows } = studentIds !== null
    ? await supabase
        .from("assessment_component_errors")
        .select(
          "section_key, section_name, word, components_missed, components_correct, initial_assessments!inner(student_id)",
        )
        .in("initial_assessments.student_id", studentIds)
    : await supabase
        .from("assessment_component_errors")
        .select(
          "section_key, section_name, word, components_missed, components_correct, initial_assessments!inner(student_id)",
        );

  // Aggregate per section_key + word
  const wordAgg = new Map<
    string,
    {
      sectionKey: string;
      sectionName: string;
      word: string;
      missedCount: number;
      students: Set<number>;
      components: Map<string, number>;
    }
  >();

  for (const row of componentErrorRows ?? []) {
    const r = row as unknown as {
      section_key: string;
      section_name: string;
      word: string;
      components_missed: string;
      initial_assessments: { student_id: number } | null;
    };
    const key = `${r.section_key}::${r.word}`;
    const existing = wordAgg.get(key) ?? {
      sectionKey: r.section_key,
      sectionName: r.section_name,
      word: r.word,
      missedCount: 0,
      students: new Set<number>(),
      components: new Map<string, number>(),
    };
    existing.missedCount++;
    if (r.initial_assessments?.student_id) {
      existing.students.add(r.initial_assessments.student_id);
    }
    if (r.components_missed) {
      for (const comp of r.components_missed.split(",")) {
        const c = comp.trim().toLowerCase();
        if (!c) continue;
        existing.components.set(c, (existing.components.get(c) ?? 0) + 1);
      }
    }
    wordAgg.set(key, existing);
  }

  const topMissedWords: MissedWordRow[] = Array.from(wordAgg.values())
    .sort((a, b) => b.missedCount - a.missedCount)
    .slice(0, topWordsLimit)
    .map((w) => ({
      sectionKey: w.sectionKey,
      sectionName: w.sectionName,
      word: w.word,
      missedCount: w.missedCount,
      studentCount: w.students.size,
      missedComponents: Array.from(w.components.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([component, count]) => ({ component, count })),
    }));

  return {
    windowDays,
    totalActiveStudents,
    sections,
    topMissedWords,
  };
}
