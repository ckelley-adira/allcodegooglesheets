/**
 * @file dashboard/assessments/new/wizard.tsx — Multi-page assessment wizard
 *
 * Client component that walks a tutor through the initial assessment for a
 * single student. Mirrors the legacy assessmentform.html flow:
 *
 *   1. Setup page    — pick student, snapshot type, date, KG-EOY toggle
 *   2. Section pages — one page per assessment section, with 3-state buttons
 *                       per component and Y/N/Reset bulk actions
 *   3. Review page   — section completion chips + section heatmap, submit
 *
 * Each component button cycles unset → correct → incorrect → correct.
 * On submit the full SubmittedSection[] payload is JSON-encoded into the
 * server action, which delegates scoring + persistence to the DAL.
 */

"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  getAssessmentSectionsForGrade,
  type AssessmentSection,
} from "@/lib/assessment/sections";
import {
  buildSubmissionFromSections,
  type SubmittedSection,
  type SubmittedWord,
  type ComponentResult,
} from "@/lib/assessment/scoring";
import {
  submitAssessmentAction,
  type AssessmentFormState,
} from "../actions";
import {
  SNAPSHOT_LABELS,
  type SnapshotType,
} from "@/lib/assessment/snapshots";
import { cn } from "@/lib/utils";

export interface WizardStudent {
  studentId: number;
  firstName: string;
  lastName: string;
  gradeName: string;
  /** Numeric grade level (0=KG, 1-8) */
  grade: number;
}

interface AssessmentWizardProps {
  students: WizardStudent[];
  yearId: number;
  yearLabel: string;
}

const INITIAL_STATE: AssessmentFormState = { error: null, success: false };

const SNAPSHOT_OPTIONS: { value: SnapshotType; label: string }[] = [
  { value: "baseline", label: SNAPSHOT_LABELS.baseline },
  { value: "semester_1_end", label: SNAPSHOT_LABELS.semester_1_end },
  { value: "semester_2_end", label: SNAPSHOT_LABELS.semester_2_end },
];

export function AssessmentWizard({
  students,
  yearId,
  yearLabel,
}: AssessmentWizardProps) {
  const [studentId, setStudentId] = useState<number | null>(null);
  const [snapshotType, setSnapshotType] = useState<SnapshotType>("baseline");
  const [assessmentDate, setAssessmentDate] = useState<string>(
    () => new Date().toISOString().split("T")[0],
  );
  const [isKgEoy, setIsKgEoy] = useState(false);
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState<"setup" | { section: number } | "review">(
    "setup",
  );
  const [sections, setSections] = useState<SubmittedSection[]>([]);
  const [, startTransition] = useTransition();
  const [formState, formAction] = useActionState(
    submitAssessmentAction,
    INITIAL_STATE,
  );

  const student = useMemo(
    () => students.find((s) => s.studentId === studentId) ?? null,
    [students, studentId],
  );

  // Recompute sections any time student or KG-EOY toggle changes.
  // useMemo would be wrong here because we want to reset Y/N state.
  const startAssessment = () => {
    if (!student) return;
    const filtered = getAssessmentSectionsForGrade(student.grade, isKgEoy);
    setSections(buildSubmissionFromSections(filtered));
    setPage(filtered.length > 0 ? { section: 0 } : "review");
  };

  const updateComponent = (
    sectionIdx: number,
    wordIdx: number,
    componentIdx: number,
    nextResult: ComponentResult,
  ) => {
    setSections((prev) => {
      const next = prev.slice();
      const section = { ...next[sectionIdx] };
      section.words = section.words.slice();
      const word = { ...section.words[wordIdx] };
      word.components = word.components.slice();
      const currentComponent = word.components[componentIdx];
      // Ensure component is an object, not a string
      const component = typeof currentComponent === "string"
        ? { name: "", lessons: [], result: "unset" }
        : currentComponent;
      word.components[componentIdx] = {
        ...component,
        result: nextResult,
      };
      section.words[wordIdx] = word;
      next[sectionIdx] = section;
      return next;
    });
  };

  const cycleComponent = (
    sectionIdx: number,
    wordIdx: number,
    componentIdx: number,
  ) => {
    const current =
      sections[sectionIdx].words[wordIdx].components[componentIdx].result;
    // Cycle: unset → correct → incorrect → unset
    const next: ComponentResult =
      current === "unset" ? "correct" :
      current === "correct" ? "incorrect" :
      "unset";
    updateComponent(sectionIdx, wordIdx, componentIdx, next);
  };

  const bulkSection = (
    sectionIdx: number,
    nextResult: ComponentResult | "unset",
  ) => {
    setSections((prev) => {
      const next = prev.slice();
      const section = { ...next[sectionIdx] };
      section.words = section.words.map((w) => ({
        ...w,
        components: w.components.map((c) => {
          // Ensure c is an object with proper structure
          const component = typeof c === "string" ? { name: "", lessons: [], result: "unset" } : c;
          return { ...component, result: nextResult };
        }),
      }));
      next[sectionIdx] = section;
      return next;
    });
  };

  const counts = useMemo(() => countResults(sections), [sections]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          New Initial Assessment
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Academic year {yearLabel}
        </p>
      </div>

      {formState.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {formState.error}
        </div>
      )}

      {page === "setup" && (
        <SetupPage
          students={students}
          studentId={studentId}
          onStudentChange={setStudentId}
          snapshotType={snapshotType}
          onSnapshotChange={setSnapshotType}
          assessmentDate={assessmentDate}
          onDateChange={setAssessmentDate}
          isKgEoy={isKgEoy}
          onKgEoyChange={setIsKgEoy}
          notes={notes}
          onNotesChange={setNotes}
          onStart={startAssessment}
          student={student}
        />
      )}

      {typeof page === "object" && (
        <SectionPage
          section={sections[page.section]}
          sectionIndex={page.section}
          totalSections={sections.length}
          student={student}
          onComponentClick={cycleComponent}
          onBulk={bulkSection}
          onPrev={() =>
            setPage(
              page.section === 0 ? "setup" : { section: page.section - 1 },
            )
          }
          onNext={() =>
            setPage(
              page.section + 1 >= sections.length
                ? "review"
                : { section: page.section + 1 },
            )
          }
          onJumpToReview={() => setPage("review")}
        />
      )}

      {page === "review" && (
        <ReviewPage
          sections={sections}
          counts={counts}
          student={student}
          snapshotType={snapshotType}
          onJumpToSection={(idx) => setPage({ section: idx })}
        >
          <form
            action={(fd) => {
              // DEBUG: Log what's being submitted (clearer format)
              const sectionsStr = fd.get("sections");
              if (typeof sectionsStr === "string") {
                try {
                  const parsed = JSON.parse(sectionsStr);
                  console.log("[FORM JSON] Full sections JSON:", JSON.stringify(parsed, null, 2).substring(0, 1000));
                  if (parsed.length > 0) {
                    const firstWord = parsed[0].words[0];
                    console.log("[FORM DEBUG] First word:", firstWord.word);
                    console.log("[FORM DEBUG] First word first component raw:", firstWord.components[0]);
                    console.log("[FORM DEBUG] Is first component an object?", typeof firstWord.components[0] === "object");
                    // Log a sampling of component results
                    console.log("[FORM DEBUG] Component results in first section:");
                    for (const w of parsed[0].words.slice(0, 3)) {
                      for (const c of w.components) {
                        console.log(`  ${w.word} / ${c.name}: ${c.result}`);
                      }
                    }
                  }
                } catch(e) {
                  console.error("[FORM DEBUG] Failed to parse sections:", e);
                }
              }
              startTransition(() => formAction(fd));
            }}
            className="flex flex-wrap items-center gap-2 pt-2"
          >
            <input type="hidden" name="studentId" value={String(studentId ?? "")} />
            <input type="hidden" name="yearId" value={String(yearId)} />
            <input type="hidden" name="snapshotType" value={snapshotType} />
            <input type="hidden" name="assessmentDate" value={assessmentDate} />
            {isKgEoy && (
              <input type="hidden" name="isKindergartenEoy" value="on" />
            )}
            <input type="hidden" name="notes" value={notes} />
            <input
              type="hidden"
              name="sections"
              value={JSON.stringify(sections)}
            />
            <SubmitButton />
            <button
              type="button"
              onClick={() => setPage("setup")}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Back to setup
            </button>
          </form>
        </ReviewPage>
      )}
    </div>
  );
}

// ── Subviews ─────────────────────────────────────────────────────────────

interface SetupPageProps {
  students: WizardStudent[];
  studentId: number | null;
  onStudentChange: (id: number) => void;
  snapshotType: SnapshotType;
  onSnapshotChange: (s: SnapshotType) => void;
  assessmentDate: string;
  onDateChange: (d: string) => void;
  isKgEoy: boolean;
  onKgEoyChange: (b: boolean) => void;
  notes: string;
  onNotesChange: (n: string) => void;
  onStart: () => void;
  student: WizardStudent | null;
}

function SetupPage(props: SetupPageProps) {
  const showKgEoy = props.student?.grade === 0;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold">Setup</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Student
          </span>
          <select
            value={props.studentId ?? ""}
            onChange={(e) => props.onStudentChange(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Select student…</option>
            {props.students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.lastName}, {s.firstName} ({s.gradeName})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Snapshot
          </span>
          <select
            value={props.snapshotType}
            onChange={(e) =>
              props.onSnapshotChange(e.target.value as SnapshotType)
            }
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SNAPSHOT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Assessment date
          </span>
          <input
            type="date"
            value={props.assessmentDate}
            onChange={(e) => props.onDateChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {showKgEoy && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={props.isKgEoy}
              onChange={(e) => props.onKgEoyChange(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span>Kindergarten end-of-year (adds digraphs + VCE sections)</span>
          </label>
        )}
      </div>

      <label className="block text-sm">
        <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Notes (optional)
        </span>
        <textarea
          value={props.notes}
          onChange={(e) => props.onNotesChange(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={props.onStart}
          disabled={props.studentId === null}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start assessment →
        </button>
      </div>
    </div>
  );
}

interface SectionPageProps {
  section: SubmittedSection | undefined;
  sectionIndex: number;
  totalSections: number;
  student: WizardStudent | null;
  onComponentClick: (sIdx: number, wIdx: number, cIdx: number) => void;
  onBulk: (sIdx: number, next: ComponentResult | "unset") => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpToReview: () => void;
}

function SectionPage(props: SectionPageProps) {
  if (!props.section) return null;
  const isLast = props.sectionIndex === props.totalSections - 1;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {props.student?.firstName} {props.student?.lastName} ·{" "}
            Section {props.sectionIndex + 1} of {props.totalSections}
          </div>
          <h2 className="text-lg font-semibold">{props.section.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => props.onBulk(props.sectionIndex, "correct")}
            className="rounded-md border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
          >
            ✓ All Correct
          </button>
          <button
            type="button"
            onClick={() => props.onBulk(props.sectionIndex, "incorrect")}
            className="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            ✗ All Incorrect
          </button>
          <button
            type="button"
            onClick={() => props.onBulk(props.sectionIndex, "unset")}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.section.words.map((word, wIdx) => (
          <WordCard
            key={`${word.word}-${wIdx}`}
            word={word}
            onComponentClick={(cIdx) =>
              props.onComponentClick(props.sectionIndex, wIdx, cIdx)
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={props.onPrev}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onJumpToReview}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Jump to review
          </button>
          <button
            type="button"
            onClick={props.onNext}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            {isLast ? "Review →" : "Next section →"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface WordCardProps {
  word: SubmittedWord;
  onComponentClick: (componentIdx: number) => void;
}

function WordCard({ word, onComponentClick }: WordCardProps) {
  const states = word.components.map((c) => c.result);
  let bg = "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800";
  if (states.every((s) => s === "correct")) {
    bg = "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-900";
  } else if (states.every((s) => s === "incorrect")) {
    bg = "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900";
  } else if (states.some((s) => s !== "unset")) {
    bg = "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900";
  }

  return (
    <div className={cn("rounded-lg border p-3 shadow-sm", bg)}>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-zinc-400">{word.number}</span>
        <span className="text-base font-bold tracking-wide">{word.word}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {word.components.map((c, cIdx) => (
          <button
            key={`${c.name}-${cIdx}`}
            type="button"
            onClick={() => onComponentClick(cIdx)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-mono font-medium",
              c.result === "correct" &&
                "border-green-500 bg-green-500 text-white",
              c.result === "incorrect" &&
                "border-red-500 bg-red-500 text-white",
              c.result === "unset" &&
                "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ReviewPageProps {
  sections: SubmittedSection[];
  counts: ReturnType<typeof countResults>;
  student: WizardStudent | null;
  snapshotType: SnapshotType;
  onJumpToSection: (idx: number) => void;
  children: React.ReactNode;
}

function ReviewPage(props: ReviewPageProps) {
  const { total, correct, incorrect, unset } = props.counts;
  const masteryPct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Review</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {props.student?.firstName} {props.student?.lastName} ·{" "}
          {SNAPSHOT_LABELS[props.snapshotType]}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Items" value={String(total)} />
          <Stat label="Correct" value={String(correct)} valueClass="text-green-600 dark:text-green-400" />
          <Stat label="Incorrect" value={String(incorrect)} valueClass="text-red-600 dark:text-red-400" />
          <Stat label="Unassessed" value={String(unset)} valueClass="text-zinc-500" />
          <Stat label="Mastery" value={`${masteryPct}%`} />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold">Sections</h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Per-section breakdown of what you&rsquo;re about to submit. Click a
          chip to jump back to that section.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.sections.map((section, idx) => {
            let sCorrect = 0;
            let sIncorrect = 0;
            let sUnset = 0;
            for (const w of section.words) {
              for (const c of w.components) {
                if (c.result === "correct") sCorrect++;
                else if (c.result === "incorrect") sIncorrect++;
                else sUnset++;
              }
            }
            const sectionTotal = sCorrect + sIncorrect + sUnset;
            const isComplete = sUnset === 0 && sectionTotal > 0;
            const allWrong = sectionTotal > 0 && sIncorrect === sectionTotal;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => props.onJumpToSection(idx)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-left text-xs font-medium",
                  allWrong
                    ? "border-red-400 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
                    : isComplete
                      ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
                      : sCorrect + sIncorrect > 0
                        ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        : "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
                )}
              >
                <div className="font-semibold">{section.name}</div>
                <div className="mt-0.5 flex gap-2 text-[10px] tabular-nums">
                  <span className="text-green-700 dark:text-green-400">
                    ✓ {sCorrect}
                  </span>
                  <span className="text-red-700 dark:text-red-400">
                    ✗ {sIncorrect}
                  </span>
                  <span className="text-zinc-500">
                    ? {sUnset}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {unset > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          ⚠️ {unset} component{unset === 1 ? "" : "s"} not yet assessed.
          You can still submit, but unscored items contribute nothing to the
          baseline.
        </div>
      )}

      {props.children}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className={cn("text-2xl font-bold", valueClass)}>{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Submitting…" : "Submit assessment"}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function countResults(sections: SubmittedSection[]) {
  let total = 0;
  let correct = 0;
  let incorrect = 0;
  let unset = 0;
  for (const section of sections) {
    for (const word of section.words) {
      for (const component of word.components) {
        total++;
        if (component.result === "correct") correct++;
        else if (component.result === "incorrect") incorrect++;
        else unset++;
      }
    }
  }
  return { total, correct, incorrect, unset };
}

// re-export so the page file can use the type without importing twice
export type { AssessmentSection };
