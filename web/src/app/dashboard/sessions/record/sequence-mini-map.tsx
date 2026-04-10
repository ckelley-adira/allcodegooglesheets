/**
 * @file sequence-mini-map.tsx — Compact sequence progress strip
 *
 * Visual confirmation widget for the Tutor Input Form. Shows a horizontal
 * strip of lesson slots in the group's active instructional sequence,
 * color-coded by status:
 *
 *   - Green  → completed
 *   - Amber  → current (the lesson being taught now)
 *   - White  → upcoming
 *   - Strikethrough → skipped
 *
 * When a lesson is selected in the form, its slot pulses with a ring to
 * show "you are here." After submission, the slot turns green on the
 * next data refresh.
 *
 * Inspired by the Google Sheets "KG Groups" view that teachers love —
 * each column is a lesson slot, and the color fills in as lessons are
 * recorded, giving immediate visual confirmation of progress.
 */

"use client";

import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

interface SequenceMapLesson {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  isReview: boolean;
  status: "upcoming" | "current" | "completed" | "skipped";
  plannedDate: string | null;
}

interface SequenceMapData {
  sequenceId: number;
  sequenceName: string;
  lessonCount: number;
  completedCount: number;
  lessons: SequenceMapLesson[];
}

interface SequenceMiniMapProps {
  sequenceMap: SequenceMapData;
  selectedLessonId: number | null;
}

// ── Component ────────────────────────────────────────────────────────────

export function SequenceMiniMap({
  sequenceMap,
  selectedLessonId,
}: SequenceMiniMapProps) {
  const { lessons, sequenceName, completedCount, lessonCount } = sequenceMap;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {sequenceName}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          {completedCount}/{lessonCount}
        </p>
      </div>

      {/* Lesson strip */}
      <div className="flex gap-1 overflow-x-auto p-3">
        {lessons.map((lesson) => {
          const isSelected = lesson.lessonId === selectedLessonId;
          return (
            <LessonSlot
              key={lesson.lessonId}
              lesson={lesson}
              isSelected={isSelected}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />
          Done
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
          Current
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900" />
          Upcoming
        </span>
      </div>
    </div>
  );
}

// ── Lesson Slot ──────────────────────────────────────────────────────────

function LessonSlot({
  lesson,
  isSelected,
}: {
  lesson: SequenceMapLesson;
  isSelected: boolean;
}) {
  const isCompleted = lesson.status === "completed";
  const isCurrent = lesson.status === "current";
  const isSkipped = lesson.status === "skipped";

  return (
    <div
      title={`L${lesson.lessonNumber}${lesson.lessonName ? ` — ${lesson.lessonName}` : ""}${lesson.isReview ? " (Review)" : ""}${lesson.plannedDate ? ` | ${lesson.plannedDate}` : ""}`}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold transition-all",
        // Status colors
        isCompleted &&
          "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
        isCurrent &&
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
        isSkipped &&
          "bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-900 dark:text-zinc-600",
        !isCompleted &&
          !isCurrent &&
          !isSkipped &&
          "border border-zinc-200 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500",
        // Selected ring (pulsing)
        isSelected &&
          "ring-2 ring-amber-400 ring-offset-1 dark:ring-amber-600 dark:ring-offset-zinc-950",
      )}
    >
      {lesson.lessonNumber}
    </div>
  );
}
