/**
 * @file sequence-panel.tsx — Display panel for a group's active sequence
 *
 * Server component that renders the active sequence's lessons with:
 * - The current lesson highlighted
 * - Completed lessons dimmed
 * - Upcoming lessons with planned dates
 * - An "Advance to next" button (form posts to advanceSequenceAction)
 *
 * If the group has no active sequence, shows an empty state with a CTA
 * to build one.
 */

import type { SequenceDetail } from "@/lib/dal/sequences";
import { Badge } from "@/components/ui/badge";
import { advanceSequenceAction, deleteSequenceAction } from "./actions";
import { cn } from "@/lib/utils";

interface SequencePanelProps {
  sequence: SequenceDetail;
  groupId: number;
  canEdit: boolean;
}

export function SequencePanel({
  sequence,
  groupId,
  canEdit,
}: SequencePanelProps) {
  const currentLesson = sequence.lessons.find((l) => l.status === "current");
  const hasUpcoming = sequence.lessons.some((l) => l.status === "upcoming");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{sequence.name}</h3>
            <Badge
              variant={
                sequence.status === "active"
                  ? "success"
                  : sequence.status === "completed"
                    ? "info"
                    : "default"
              }
            >
              {sequence.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {sequence.startDate && sequence.endDate
              ? `${sequence.startDate} → ${sequence.endDate}`
              : sequence.startDate ?? "No date range"}{" "}
            &middot; {sequence.completedCount}/{sequence.lessonCount} completed
          </p>
        </div>
        {canEdit && sequence.status === "active" && currentLesson && (
          <form action={advanceSequenceAction}>
            <input type="hidden" name="sequenceId" value={sequence.sequenceId} />
            <input type="hidden" name="groupId" value={groupId} />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {hasUpcoming ? "Mark Complete & Advance" : "Mark Complete"}
            </button>
          </form>
        )}
      </div>

      {/* Lesson list */}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {sequence.lessons.map((lesson) => {
          const isCurrent = lesson.status === "current";
          const isCompleted = lesson.status === "completed";
          const isSkipped = lesson.status === "skipped";

          return (
            <li
              key={lesson.lessonId}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm",
                isCurrent &&
                  "bg-amber-50 dark:bg-amber-950/30",
                isCompleted && "text-zinc-400 dark:text-zinc-600",
                isSkipped && "text-zinc-400 line-through dark:text-zinc-600",
              )}
            >
              {/* Status dot */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                {isCurrent ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                ) : isCompleted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-green-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : isSkipped ? (
                  <span className="text-xs text-zinc-400">—</span>
                ) : (
                  <span className="h-2 w-2 rounded-full border border-zinc-300 dark:border-zinc-700" />
                )}
              </div>

              {/* Lesson number */}
              <span
                className={cn(
                  "w-12 shrink-0 font-mono text-xs",
                  isCurrent
                    ? "font-bold text-amber-900 dark:text-amber-200"
                    : "text-zinc-400",
                )}
              >
                L{lesson.lessonNumber}
              </span>

              {/* Lesson name */}
              <div className="flex-1 truncate">
                <span
                  className={cn(
                    isCurrent
                      ? "font-semibold text-zinc-900 dark:text-zinc-100"
                      : "",
                  )}
                >
                  {lesson.lessonName ?? `Lesson ${lesson.lessonNumber}`}
                </span>
                {lesson.isReview && (
                  <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Review
                  </span>
                )}
              </div>

              {/* Planned date */}
              {lesson.plannedDate && (
                <span className="shrink-0 text-xs text-zinc-400">
                  {lesson.plannedDate}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer actions for draft/completed sequences */}
      {canEdit && sequence.status !== "active" && (
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <form action={deleteSequenceAction}>
            <input type="hidden" name="sequenceId" value={sequence.sequenceId} />
            <input type="hidden" name="groupId" value={groupId} />
            <button
              type="submit"
              className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              Delete sequence
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
