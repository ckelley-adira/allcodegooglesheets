/**
 * @file dal/ufli-map.ts — Data access layer for the UFLI MAP view
 *
 * Builds the student×lesson grid (the core progress visualization).
 * Each cell is Y / N / A / null. Uses Supabase JS client (PostgREST/HTTPS).
 *
 * @rls School-scoping enforced by RLS policies via the user's JWT.
 */

import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────────

export interface LessonColumn {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  skillSection: string;
  isReview: boolean;
}

export interface StudentMapRow {
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeName: string;
  groupName: string | null;
  outcomes: Record<number, "Y" | "N" | "A">;
}

export interface UfliMapData {
  lessons: LessonColumn[];
  students: StudentMapRow[];
  skillSections: { name: string; startIndex: number; count: number }[];
}

// ── Query ────────────────────────────────────────────────────────────────

/**
 * Builds the complete UFLI MAP dataset for a school.
 *
 * @rls Filters by school_id explicitly when fetching unfiltered students.
 */
export async function getUfliMapData(
  schoolId: number,
  yearId: number,
  groupId?: number,
): Promise<UfliMapData> {
  const supabase = await createClient();

  // 1. Get all lesson columns (reference data)
  const { data: lessonRows, error: lessonError } = await supabase
    .from("ufli_lessons")
    .select("lesson_id, lesson_number, lesson_name, skill_section, is_review, sort_order")
    .order("sort_order", { ascending: true });

  if (lessonError) throw new Error(lessonError.message);

  const lessons: LessonColumn[] = (lessonRows ?? []).map((r) => ({
    lessonId: r.lesson_id,
    lessonNumber: r.lesson_number,
    lessonName: r.lesson_name,
    skillSection: r.skill_section,
    isReview: r.is_review,
  }));

  // 2. Build skill section boundaries
  const skillSections: { name: string; startIndex: number; count: number }[] = [];
  let currentSection = "";
  for (let i = 0; i < lessons.length; i++) {
    if (lessons[i].skillSection !== currentSection) {
      currentSection = lessons[i].skillSection;
      skillSections.push({ name: currentSection, startIndex: i, count: 1 });
    } else {
      skillSections[skillSections.length - 1].count++;
    }
  }

  // 3. Get students (optionally filtered by group)
  let studentRows: {
    studentId: number;
    firstName: string;
    lastName: string;
    studentNumber: string;
    gradeName: string;
    gradeSortOrder: number;
    groupName: string | null;
  }[];

  if (groupId) {
    const { data, error } = await supabase
      .from("group_memberships")
      .select(
        "students(student_id, first_name, last_name, student_number, enrollment_status, grade_levels(name, sort_order)), instructional_groups(group_name)",
      )
      .eq("group_id", groupId)
      .eq("is_active", true);

    if (error) throw new Error(error.message);

    studentRows = (data ?? [])
      .map((r) => {
        const raw = r as unknown as {
          students: {
            student_id: number;
            first_name: string;
            last_name: string;
            student_number: string;
            enrollment_status: string;
            grade_levels: { name: string; sort_order: number } | null;
          } | null;
          instructional_groups: { group_name: string } | null;
        };
        if (!raw.students || raw.students.enrollment_status !== "active") return null;
        return {
          studentId: raw.students.student_id,
          firstName: raw.students.first_name,
          lastName: raw.students.last_name,
          studentNumber: raw.students.student_number,
          gradeName: raw.students.grade_levels?.name ?? "",
          gradeSortOrder: raw.students.grade_levels?.sort_order ?? 0,
          groupName: raw.instructional_groups?.group_name ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  } else {
    const { data, error } = await supabase
      .from("students")
      .select(
        "student_id, first_name, last_name, student_number, grade_levels(name, sort_order)",
      )
      .eq("school_id", schoolId)
      .eq("enrollment_status", "active");

    if (error) throw new Error(error.message);

    studentRows = (data ?? []).map((r) => {
      const raw = r as unknown as {
        student_id: number;
        first_name: string;
        last_name: string;
        student_number: string;
        grade_levels: { name: string; sort_order: number } | null;
      };
      return {
        studentId: raw.student_id,
        firstName: raw.first_name,
        lastName: raw.last_name,
        studentNumber: raw.student_number,
        gradeName: raw.grade_levels?.name ?? "",
        gradeSortOrder: raw.grade_levels?.sort_order ?? 0,
        groupName: null,
      };
    });

    // Look up each student's current group separately
    const studentIds = studentRows.map((s) => s.studentId);
    if (studentIds.length > 0) {
      const { data: memberships, error: memError } = await supabase
        .from("group_memberships")
        .select("student_id, instructional_groups(group_name)")
        .eq("is_active", true)
        .in("student_id", studentIds);

      if (memError) throw new Error(memError.message);
      const groupMap = new Map<number, string>();
      for (const m of memberships ?? []) {
        const raw = m as unknown as {
          student_id: number;
          instructional_groups: { group_name: string } | null;
        };
        if (raw.instructional_groups) {
          groupMap.set(raw.student_id, raw.instructional_groups.group_name);
        }
      }
      studentRows.forEach((s) => {
        s.groupName = groupMap.get(s.studentId) ?? null;
      });
    }
  }

  // Sort students by grade then last name then first name
  studentRows.sort((a, b) => {
    if (a.gradeSortOrder !== b.gradeSortOrder)
      return a.gradeSortOrder - b.gradeSortOrder;
    const ln = a.lastName.localeCompare(b.lastName);
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName);
  });

  if (studentRows.length === 0) {
    return { lessons, students: [], skillSections };
  }

  // 4. Get all lesson progress for these students in this year
  const studentIds = studentRows.map((s) => s.studentId);
  const { data: progressRows, error: progressError } = await supabase
    .from("lesson_progress")
    .select("student_id, lesson_id, status")
    .in("student_id", studentIds)
    .eq("year_id", yearId);

  if (progressError) throw new Error(progressError.message);

  // 5. Build the outcomes map
  const outcomesMap = new Map<number, Record<number, "Y" | "N" | "A">>();
  for (const row of progressRows ?? []) {
    if (!outcomesMap.has(row.student_id)) {
      outcomesMap.set(row.student_id, {});
    }
    outcomesMap.get(row.student_id)![row.lesson_id] = row.status as "Y" | "N" | "A";
  }

  // 6. Assemble student rows
  const mapStudents: StudentMapRow[] = studentRows.map((s) => ({
    studentId: s.studentId,
    firstName: s.firstName,
    lastName: s.lastName,
    studentNumber: s.studentNumber,
    gradeName: s.gradeName,
    groupName: s.groupName,
    outcomes: outcomesMap.get(s.studentId) ?? {},
  }));

  return { lessons, students: mapStudents, skillSections };
}
