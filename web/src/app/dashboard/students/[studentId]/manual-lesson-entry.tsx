/**
 * @file manual-lesson-entry.tsx — Admin manual lesson recorder
 *
 * Client component rendering a compact form: lesson dropdown + Y/N/A
 * buttons + date picker + submit. Used on the student detail page for
 * one-off entries outside the group session flow.
 *
 * Admin-only — the parent server component gates rendering by role.
 */

"use client";

import { useActionState, useState } from "react";
import {
  recordManualLessonAction,
  type ManualEntryFormState,
} from "./actions";
import { cn } from "@/lib/utils";

interface LessonOption {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  isReview: boolean;
}

interface ManualLessonEntryProps {
  studentId: number;
  yearId: number;
  lessons: LessonOption[];
}

type Status = "Y" | "N" | "A" | null;

const initialState: ManualEntryFormState = { error: null, success: false };

export function ManualLessonEntry({
  studentId,
  yearId,
  lessons,
}: ManualLessonEntryProps) {
  const [state, formAction, isPending] = useActionState(
    recordManualLessonAction,
    initialState,
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [status, setStatus] = useState<Status>(null);
  const [dateRecorded, setDateRecorded] = useState(
    new Date().toISOString().split("T")[0],
  );

  const canSubmit = selectedLessonId && status && !isPending;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Record Lesson (Admin)</h3>
        <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
          Manual entry — group-independent, tagged as source &quot;manual&quot;
          for audit.
        </p>
      </div>

      <div className="space-y-3 p-4">
        {state.success && (
          <div className="rounded-lg bg-green-50 p-2 text-xs text-green-800 dark:bg-green-950/50 dark:text-green-300">
            Lesson recorded successfully.
          </div>
        )}
        {state.error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </div>
        )}

        {/* Lesson picker */}
        <select
          value={selectedLessonId}
          onChange={(e) => setSelectedLessonId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Select a lesson...</option>
          {lessons.map((l) => (
            <option key={l.lessonId} value={l.lessonId}>
              L{l.lessonNumber}
              {l.lessonName ? ` — ${l.lessonName}` : ""}
              {l.isReview ? " (Review)" : ""}
            </option>
          ))}
        </select>

        {/* Status buttons */}
        <div className="flex gap-2">
          <StatusButton
            label="Y"
            sublabel="Passed"
            active={status === "Y"}
            variant="yes"
            onClick={() => setStatus(status === "Y" ? null : "Y")}
          />
          <StatusButton
            label="N"
            sublabel="Not Passed"
            active={status === "N"}
            variant="no"
            onClick={() => setStatus(status === "N" ? null : "N")}
          />
          <StatusButton
            label="A"
            sublabel="Absent"
            active={status === "A"}
            variant="absent"
            onClick={() => setStatus(status === "A" ? null : "A")}
          />
        </div>

        {/* Date */}
        <input
          type="date"
          value={dateRecorded}
          onChange={(e) => setDateRecorded(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />

        {/* Submit */}
        <form action={formAction}>
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="lessonId" value={selectedLessonId} />
          <input type="hidden" name="yearId" value={yearId} />
          <input type="hidden" name="status" value={status ?? ""} />
          <input type="hidden" name="dateRecorded" value={dateRecorded} />
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-zinc-900 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Saving..." : "Record Lesson"}
          </button>
        </form>
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

function StatusButton({
  label,
  sublabel,
  active,
  variant,
  onClick,
}: {
  label: string;
  sublabel: string;
  active: boolean;
  variant: keyof typeof BUTTON_STYLES;
  onClick: () => void;
}) {
  const styles = BUTTON_STYLES[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-lg border-2 py-2 text-sm font-bold transition-all active:scale-95",
        active ? styles.active : styles.base,
      )}
    >
      {label}
      <span className="text-[10px] font-normal opacity-70">{sublabel}</span>
    </button>
  );
}
