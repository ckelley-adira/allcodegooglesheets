/**
 * @file build-sequence-form.tsx — Form for creating a new Instructional Sequence
 *
 * Collapsible form that lets a coach build a sequence for a group by:
 *   1. Naming it (defaulted to "Sequence N")
 *   2. Setting the start date
 *   3. Confirming/adjusting cadence days (pre-filled from school settings)
 *   4. Selecting an ordered list of UFLI lessons (the core task)
 *
 * Lesson picker UX:
 *   - Shows all 128 UFLI lessons as a scrollable list
 *   - Filter box for lesson number or name
 *   - Click to add a lesson to the ordered sequence (right panel)
 *   - Click a selected lesson to remove it
 *   - Up/down buttons to reorder the selected list
 *   - Grade-range hint: highlights lessons within the group's max grade range
 *
 * On submit, the form posts lessonIds[] as an ordered list that
 * buildSequenceAction passes straight to the DAL.
 */

"use client";

import { useActionState, useState, useEffect, useMemo } from "react";
import { buildSequenceAction, type SequenceFormState } from "./actions";
import { cn } from "@/lib/utils";
import { CADENCE_DAY_CODES } from "@/config/cadence";

const initialState: SequenceFormState = { error: null, success: false };

interface Lesson {
  lessonId: number;
  lessonNumber: number;
  lessonName: string | null;
  skillSection: string;
  isReview: boolean;
}

interface BuildSequenceFormProps {
  groupId: number;
  yearId: number;
  defaultCadenceDays: string[];
  /** Suggested name (e.g. "Sequence 3") */
  defaultName: string;
  /** Max grade-range lesson number for the group (used for highlighting) */
  maxGradeRangeLesson?: number;
  allLessons: Lesson[];
}

export function BuildSequenceForm({
  groupId,
  yearId,
  defaultCadenceDays,
  defaultName,
  maxGradeRangeLesson,
  allLessons,
}: BuildSequenceFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    buildSequenceAction,
    initialState,
  );

  const [filter, setFilter] = useState("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);

  function resetForm() {
    setIsOpen(false);
    setSelectedLessonIds([]);
    setFilter("");
  }

  useEffect(() => {
    if (state.success) resetForm();
  }, [state.success]);

  const lessonMap = useMemo(
    () => new Map(allLessons.map((l) => [l.lessonId, l])),
    [allLessons],
  );

  const filteredLessons = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allLessons;
    return allLessons.filter((l) => {
      if (String(l.lessonNumber).includes(q)) return true;
      if (l.lessonName?.toLowerCase().includes(q)) return true;
      if (l.skillSection.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [allLessons, filter]);

  function toggleLesson(lessonId: number) {
    setSelectedLessonIds((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId],
    );
  }

  function moveLesson(index: number, direction: -1 | 1) {
    setSelectedLessonIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeLesson(lessonId: number) {
    setSelectedLessonIds((prev) => prev.filter((id) => id !== lessonId));
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Build New Sequence
      </button>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 text-sm font-semibold">New Instructional Sequence</h3>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="yearId" value={yearId} />
        {/* Hidden ordered list of selected lesson IDs */}
        {selectedLessonIds.map((id) => (
          <input key={id} type="hidden" name="lessonIds" value={id} />
        ))}

        {state.error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </div>
        )}

        {/* Basic fields */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="seq-name" className="text-xs font-medium">
              Sequence name
            </label>
            <input
              id="seq-name"
              name="name"
              type="text"
              required
              defaultValue={defaultName}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="seq-start-date" className="text-xs font-medium">
              Start date
            </label>
            <input
              id="seq-start-date"
              name="startDate"
              type="date"
              required
              defaultValue={today}
              className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        {/* Cadence days */}
        <div className="space-y-1">
          <p className="text-xs font-medium">
            Cadence days{" "}
            <span className="text-zinc-400">
              (defaults from school settings)
            </span>
          </p>
          <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
            {CADENCE_DAY_CODES.map((code) => (
              <label
                key={code}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50 has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:checked]:ring-zinc-900 dark:bg-zinc-950 dark:ring-zinc-700 dark:hover:bg-zinc-900 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-900 dark:has-[:checked]:ring-zinc-100"
              >
                <input
                  type="checkbox"
                  name="cadenceDays"
                  value={code}
                  defaultChecked={defaultCadenceDays.includes(code)}
                  className="sr-only"
                />
                {code}
              </label>
            ))}
          </div>
        </div>

        {/* Lesson picker — two panels */}
        <div className="space-y-1">
          <p className="text-xs font-medium">
            Lessons{" "}
            <span className="text-zinc-400">
              (click to add, reorder on the right)
              {maxGradeRangeLesson
                ? ` · highlighted: within grade range (L1-L${maxGradeRangeLesson})`
                : ""}
            </span>
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Left: all lessons with filter */}
            <div className="rounded-lg border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter lessons..."
                  className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {filteredLessons.map((l) => {
                  const isSelected = selectedLessonIds.includes(l.lessonId);
                  const inGradeRange =
                    maxGradeRangeLesson !== undefined &&
                    l.lessonNumber <= maxGradeRangeLesson;
                  return (
                    <li key={l.lessonId}>
                      <button
                        type="button"
                        onClick={() => toggleLesson(l.lessonId)}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-zinc-100 px-3 py-1.5 text-left text-xs transition-colors dark:border-zinc-800",
                          isSelected
                            ? "bg-zinc-200 dark:bg-zinc-800"
                            : inGradeRange
                              ? "bg-blue-50/50 hover:bg-blue-100/50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
                        )}
                      >
                        <span className="w-10 shrink-0 font-mono text-zinc-400">
                          L{l.lessonNumber}
                        </span>
                        <span className="flex-1 truncate">
                          {l.lessonName ?? `Lesson ${l.lessonNumber}`}
                        </span>
                        {l.isReview && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                            Review
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-bold text-zinc-500">
                            ✓
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Right: selected lessons in order */}
            <div className="rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
              <div className="border-b border-zinc-200 p-2 text-xs font-medium dark:border-zinc-800">
                Selected &middot; {selectedLessonIds.length}{" "}
                {selectedLessonIds.length === 1 ? "lesson" : "lessons"}
              </div>
              {selectedLessonIds.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  No lessons selected yet.
                  <br />
                  Click a lesson on the left to add it.
                </div>
              ) : (
                <ol className="max-h-80 overflow-y-auto">
                  {selectedLessonIds.map((lessonId, i) => {
                    const lesson = lessonMap.get(lessonId);
                    if (!lesson) return null;
                    return (
                      <li
                        key={lessonId}
                        className="flex items-center gap-2 border-b border-zinc-100 px-3 py-1.5 text-xs dark:border-zinc-800"
                      >
                        <span className="w-6 shrink-0 text-zinc-400">
                          {i + 1}.
                        </span>
                        <span className="w-10 shrink-0 font-mono text-zinc-400">
                          L{lesson.lessonNumber}
                        </span>
                        <span className="flex-1 truncate">
                          {lesson.lessonName ??
                            `Lesson ${lesson.lessonNumber}`}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveLesson(i, -1)}
                            disabled={i === 0}
                            aria-label="Move up"
                            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLesson(i, 1)}
                            disabled={i === selectedLessonIds.length - 1}
                            aria-label="Move down"
                            className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLesson(lessonId)}
                            aria-label="Remove"
                            className="rounded p-0.5 text-zinc-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || selectedLessonIds.length === 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending
              ? "Building..."
              : `Build Sequence (${selectedLessonIds.length})`}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
