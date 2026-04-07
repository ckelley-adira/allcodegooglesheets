/**
 * @file api/groups/[groupId]/students/route.ts — Group students API
 *
 * Returns the active students in a group. When lessonId and yearId query
 * params are provided, also returns any existing lesson outcomes so the
 * Tutor Input Form can pre-populate the Y/N/A grid for editing.
 *
 * @rls Verifies the group belongs to the authenticated user's school.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getGroup } from "@/lib/dal/groups";
import { getGroupStudentsForEntry, getExistingOutcomes } from "@/lib/dal/sessions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId: groupIdParam } = await params;
  const groupId = Number(groupIdParam);
  if (!groupId || isNaN(groupId)) {
    return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
  }

  // Verify the group belongs to the user's school
  const group = await getGroup(groupId, user.schoolId);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const students = await getGroupStudentsForEntry(groupId);

  // If lessonId and yearId are provided, also fetch existing outcomes
  const url = new URL(request.url);
  const lessonId = Number(url.searchParams.get("lessonId"));
  const yearId = Number(url.searchParams.get("yearId"));

  let existingOutcomes: { studentId: number; status: "Y" | "N" | "A" }[] = [];
  if (lessonId && yearId) {
    existingOutcomes = await getExistingOutcomes(groupId, lessonId, yearId);
  }

  return NextResponse.json({ students, existingOutcomes });
}
