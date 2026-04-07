/**
 * @file api/groups/[groupId]/students/route.ts — Group students API
 *
 * Returns the active students in a group. Used by the Tutor Input Form
 * to dynamically load students when a group is selected.
 *
 * @rls Verifies the group belongs to the authenticated user's school.
 */

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getGroup } from "@/lib/dal/groups";
import { getGroupStudentsForEntry } from "@/lib/dal/sessions";

export async function GET(
  _request: Request,
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
  return NextResponse.json({ students });
}
