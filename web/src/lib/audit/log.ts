/**
 * @file audit/log.ts — Append-only audit log writer
 *
 * Per D-004: every data-modifying action writes a row to the audit_log
 * table. The table has INSERT-only RLS — no UPDATE or DELETE policies
 * exist — so writes here cannot be tampered with after the fact.
 *
 * Each call captures one mutation: action verb, table name, record id,
 * and a JSON snapshot of the old (before) and new (after) values when
 * available. For inserts, oldValue is null. For deletes, newValue is
 * null. For updates, both should be populated.
 *
 * Usage from a Server Action:
 *   await auditLog({
 *     schoolId: user.schoolId,
 *     userId: user.staffId,
 *     action: "UPDATE",
 *     tableName: "students",
 *     recordId: studentId,
 *     oldValue: previousRow,
 *     newValue: updatedRow,
 *   });
 *
 * @rls auth admin can insert; reads are school-scoped (D-002 + D-004).
 */

import { createClient } from "@/lib/supabase/server";

export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "ADVANCE_SEQUENCE"
  | "RECORD_LESSON_OUTCOMES";

export interface AuditLogInput {
  /** School the row belongs to (for RLS scoping) */
  schoolId: number;
  /** Staff member who performed the action; null for system actions */
  userId: number | null;
  /** What happened */
  action: AuditAction;
  /** Table the action targeted (e.g. "students", "instructional_groups") */
  tableName: string;
  /** Primary key of the affected row, when applicable */
  recordId: number | null;
  /** Snapshot of the row BEFORE the change. Null for inserts. */
  oldValue?: Record<string, unknown> | null;
  /** Snapshot of the row AFTER the change. Null for deletes. */
  newValue?: Record<string, unknown> | null;
}

/**
 * Writes one row to the audit log. Best-effort: failures are logged to
 * the console but do not throw, so callers don't need to wrap every
 * audit call in a try/catch. The user's primary action should still
 * succeed even if auditing fails.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_log").insert({
      school_id: input.schoolId,
      user_id: input.userId,
      action: input.action,
      table_name: input.tableName,
      record_id: input.recordId,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
    });

    if (error) {
      console.error("Audit log write failed:", {
        action: input.action,
        tableName: input.tableName,
        recordId: input.recordId,
        error: error.message,
      });
    }
  } catch (err) {
    console.error("Audit log write threw:", err);
  }
}
