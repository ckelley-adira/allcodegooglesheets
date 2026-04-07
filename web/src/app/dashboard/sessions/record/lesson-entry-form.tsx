/**
 * @file lesson-entry-form.tsx — The Tutor Input Form (Client Component)
 *
 * Mobile-first, step-by-step lesson data entry form. Ported from the GAS
 * LessonEntryForm.html with a modernized UX.
 *
 * Flow:
 * 1. Select group (pre-selected if coming from sessions page)
 * 2. Select UFLI lesson (L1-L128)
 * 3. Mark each student as Y (passed), N (not passed), or A (absent)
 * 4. Submit — records all outcomes in one batch
 *
 * Per D-012 (Equity of Visibility): 'A' values are a first-class status,
 * never counted as zeros.
 */

"use client";

import { useActionState, useState, useEffect, useCallback } from "react";
import { recordSessionAction, type SessionFormState } from "../actions";
import { cn } from "@/lib/utils";

const initialState: SessionFormState = { error: null, success: false };

// ── Types ────────────────────────────────────────────────────────────────

interface GroupOption {
  groupId: number;
  groupName: string;
  gradeName: string;
}

interface LessonOption {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  skillSection: string;
  isReview: boolean;
}

interface StudentEntry {
  studentId: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  gradeName: string;
}

type Status = "Y" | "N" | "A" | null;

interface LessonEntryFormProps {
  groups: GroupOption[];
  lessons: LessonOption[];
  yearId: number;
  preselectedGroupId?: number;
}

// ── Component ────────────────────────────────────────────────────────────

export function LessonEntryForm({
  groups,
  lessons,
  yearId,
  preselectedGroupId,
}: LessonEntryFormProps) {
  const [state, formAction, isPending] = useActionState(
    recordSessionAction,
    initialState,
  );

  // Step state
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    preselectedGroupId ?? null,
  );
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [dateRecorded, setDateRecorded] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Student state
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [statuses, setStatuses] = useState<Map<number, Status>>(new Map());
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Load students when group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setStudents([]);
      setStatuses(new Map());
      setIsEditingExisting(false);
      return;
    }

    setIsLoadingStudents(true);
    fetch(`/api/groups/${selectedGroupId}/students`)
      .then((res) => res.json())
      .then((data) => {
        setStudents(data.students ?? []);
        setStatuses(new Map());
        setIsEditingExisting(false);
      })
      .catch(() => {
        setStudents([]);
      })
      .finally(() => {
        setIsLoadingStudents(false);
      });
  }, [selectedGroupId]);

  // Load existing outcomes when lesson changes (for edit pre-population)
  useEffect(() => {
    if (!selectedGroupId || !selectedLessonId || !yearId) {
      setStatuses(new Map());
      setIsEditingExisting(false);
      return;
    }

    fetch(
      `/api/groups/${selectedGroupId}/students?lessonId=${selectedLessonId}&yearId=${yearId}`,
    )
      .then((res) => res.json())
      .then((data) => {
        const existing: { studentId: number; status: "Y" | "N" | "A" }[] =
          data.existingOutcomes ?? [];
        if (existing.length > 0) {
          const pre = new Map<number, Status>();
          existing.forEach((o) => pre.set(o.studentId, o.status));
          setStatuses(pre);
          setIsEditingExisting(true);
        } else {
          setStatuses(new Map());
          setIsEditingExisting(false);
        }
      })
      .catch(() => {
        // On error, just start with a blank grid
        setStatuses(new Map());
        setIsEditingExisting(false);
      });
  }, [selectedGroupId, selectedLessonId, yearId]);

  // Reset on success
  useEffect(() => {
    if (state.success) {
      setStatuses(new Map());
      setIsEditingExisting(false);
    }
  }, [state.success]);

  // Status handlers
  const setStudentStatus = useCallback((studentId: number, status: Status) => {
    setStatuses((prev) => {
      const next = new Map(prev);
      if (status === null) {
        next.delete(studentId);
      } else {
        next.set(studentId, status);
      }
      return next;
    });
  }, []);

  const setAllStatuses = useCallback(
    (status: Status) => {
      const next = new Map<number, Status>();
      if (status !== null) {
        students.forEach((s) => next.set(s.studentId, status));
      }
      setStatuses(next);
    },
    [students],
  );

  // Build outcomes JSON for the form
  const outcomes = students
    .filter((s) => statuses.get(s.studentId))
    .map((s) => ({
      studentId: s.studentId,
      status: statuses.get(s.studentId)!,
    }));

  const markedCount = outcomes.length;
  const canSubmit =
    selectedGroupId && selectedLessonId && markedCount > 0 && !isPending;

  return (
    <div className="space-y-4">
      {/* Success message */}
      {state.success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300">
          Saved {state.savedCount} student outcome
          {state.savedCount !== 1 ? "s" : ""} successfully.
        </div>
      )}

      {/* Error message */}
      {state.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </div>
      )}

      {/* Step 1: Select Group */}
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
              1
            </span>
            Select Group
          </h2>
        </div>
        <div className="p-4">
          <select
            value={selectedGroupId ?? ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSelectedGroupId(v || null);
              setSelectedLessonId(null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-3 py-3 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">-- Select a Group --</option>
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.groupName} ({g.gradeName})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Step 2: Select Lesson + Date */}
      {selectedGroupId && (
        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                2
              </span>
              Select Lesson
            </h2>
          </div>
          <div className="space-y-3 p-4">
            <select
              value={selectedLessonId ?? ""}
              onChange={(e) => setSelectedLessonId(Number(e.target.value) || null)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-3 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">-- Select a Lesson --</option>
              {lessons.map((l) => (
                <option key={l.lessonId} value={l.lessonId}>
                  L{l.lessonNumber} — {l.lessonName}
                  {l.isReview ? " (Review)" : ""}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateRecorded}
              onChange={(e) => setDateRecorded(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-3 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </section>
      )}

      {/* Step 3: Mark Students */}
      {selectedGroupId && selectedLessonId && (
        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                3
              </span>
              Mark Student Status
            </h2>
          </div>
          <div className="p-4">
            {/* Legend */}
            <div className="mb-3 flex flex-wrap gap-3 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
              <span className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100 font-bold text-green-700">
                  Y
                </span>
                Passed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-red-100 font-bold text-red-700">
                  N
                </span>
                Not Passed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 font-bold text-amber-700">
                  A
                </span>
                Absent
              </span>
            </div>

            {/* Bulk actions */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllStatuses("Y")}
                className="rounded-md border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
              >
                All Y
              </button>
              <button
                type="button"
                onClick={() => setAllStatuses("N")}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                All N
              </button>
              <button
                type="button"
                onClick={() => setAllStatuses("A")}
                className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950"
              >
                All A
              </button>
              <button
                type="button"
                onClick={() => setAllStatuses(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                Clear
              </button>
            </div>

            {/* Editing existing data indicator */}
            {isEditingExisting && (
              <div className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                Editing previously submitted data for this lesson. Change any
                values and re-submit to update.
              </div>
            )}

            {/* Student list */}
            {isLoadingStudents ? (
              <div className="py-8 text-center text-sm text-zinc-400">
                Loading students...
              </div>
            ) : students.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400">
                No active students in this group.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {students.map((student) => {
                  const currentStatus = statuses.get(student.studentId) ?? null;
                  return (
                    <StudentRow
                      key={student.studentId}
                      student={student}
                      status={currentStatus}
                      onStatusChange={(s) =>
                        setStudentStatus(student.studentId, s)
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Submit */}
      {selectedGroupId && selectedLessonId && students.length > 0 && (
        <form action={formAction}>
          <input type="hidden" name="groupId" value={selectedGroupId} />
          <input type="hidden" name="lessonId" value={selectedLessonId} />
          <input type="hidden" name="yearId" value={yearId} />
          <input type="hidden" name="dateRecorded" value={dateRecorded} />
          <input
            type="hidden"
            name="outcomes"
            value={JSON.stringify(outcomes)}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-zinc-900 py-4 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending
              ? "Saving..."
              : `Submit ${markedCount} of ${students.length} Students`}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Student Row ──────────────────────────────────────────────────────────

interface StudentRowProps {
  student: StudentEntry;
  status: Status;
  onStatusChange: (status: Status) => void;
}

function StudentRow({ student, status, onStatusChange }: StudentRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {student.firstName} {student.lastName}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {student.studentNumber}
        </p>
      </div>
      <div className="flex gap-1.5">
        <StatusButton
          label="Y"
          active={status === "Y"}
          variant="yes"
          onClick={() => onStatusChange(status === "Y" ? null : "Y")}
        />
        <StatusButton
          label="N"
          active={status === "N"}
          variant="no"
          onClick={() => onStatusChange(status === "N" ? null : "N")}
        />
        <StatusButton
          label="A"
          active={status === "A"}
          variant="absent"
          onClick={() => onStatusChange(status === "A" ? null : "A")}
        />
      </div>
    </div>
  );
}

// ── Status Button ────────────────────────────────────────────────────────

const BUTTON_STYLES = {
  yes: {
    base: "text-green-600 border-zinc-200 dark:border-zinc-700",
    active:
      "bg-green-100 border-green-500 text-green-800 dark:bg-green-950 dark:border-green-600 dark:text-green-300",
  },
  no: {
    base: "text-red-600 border-zinc-200 dark:border-zinc-700",
    active:
      "bg-red-100 border-red-500 text-red-800 dark:bg-red-950 dark:border-red-600 dark:text-red-300",
  },
  absent: {
    base: "text-amber-600 border-zinc-200 dark:border-zinc-700",
    active:
      "bg-amber-100 border-amber-500 text-amber-800 dark:bg-amber-950 dark:border-amber-600 dark:text-amber-300",
  },
} as const;

interface StatusButtonProps {
  label: string;
  active: boolean;
  variant: keyof typeof BUTTON_STYLES;
  onClick: () => void;
}

function StatusButton({ label, active, variant, onClick }: StatusButtonProps) {
  const styles = BUTTON_STYLES[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all active:scale-95",
        active ? styles.active : styles.base,
      )}
    >
      {label}
    </button>
  );
}
