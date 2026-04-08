/**
 * @file dashboard/monday-digest/page.tsx — Monday Coaching Digest
 *
 * Phase C.3c. Same data as /dashboard/coaching but organized into the
 * five narrative buckets from fcdBuildMondayDigest_ so it reads like a
 * coaching brief rather than a priority queue:
 *
 *   🎉 Celebrations      — section completions at mastery
 *   🟢 Speed Up          — fast-track recommendations
 *   🔵 Hold & Help       — coaching focus visits
 *   🚨 MTSS Escalation   — tier3 + systemic
 *   🟡 Fidelity Check    — fidelity + weak section close
 *
 * Deferred: actual email sending (fcdBuildMondayDigest_ generates HTML
 * for Gmail; we keep the dashboard view for now and wire email later).
 */

import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import {
  getCoachingSnapshot,
  type PriorityItem,
  type PriorityItemType,
} from "@/lib/dal/coaching";

interface BucketDef {
  title: string;
  icon: string;
  description: string;
  emptyMsg: string;
  types: PriorityItemType[];
  titleClass: string;
  cardClass: string;
  borderClass: string;
}

const BUCKETS: BucketDef[] = [
  {
    title: "Celebrations",
    icon: "🎉",
    description:
      "Groups that completed a skill section with strong mastery. Recognize the work!",
    emptyMsg: "No section completions this week.",
    types: ["celebration"],
    titleClass: "text-purple-700 dark:text-purple-300",
    cardClass: "bg-purple-50 dark:bg-purple-950/20",
    borderClass: "border-l-purple-500",
  },
  {
    title: "Speed Up",
    icon: "🟢",
    description:
      "These groups are ready to accelerate. Students are at mastery — move them forward.",
    emptyMsg: "No groups flagged for acceleration this week.",
    types: ["fasttrack"],
    titleClass: "text-green-700 dark:text-green-300",
    cardClass: "bg-green-50 dark:bg-green-950/20",
    borderClass: "border-l-green-500",
  },
  {
    title: "Hold & Help",
    icon: "🔵",
    description:
      "High reteach counts signal instructional breakdown. Visit these groups Monday.",
    emptyMsg: "No coaching interventions needed this week.",
    types: ["coaching"],
    titleClass: "text-blue-700 dark:text-blue-300",
    cardClass: "bg-blue-50 dark:bg-blue-950/20",
    borderClass: "border-l-blue-500",
  },
  {
    title: "MTSS Escalation",
    icon: "🚨",
    description:
      "Students or groups needing Tier 3 review or systemic intervention.",
    emptyMsg:
      "No escalations this week — all students tracking within expected range.",
    types: ["tier3", "systemic"],
    titleClass: "text-red-700 dark:text-red-300",
    cardClass: "bg-red-50 dark:bg-red-950/20",
    borderClass: "border-l-red-500",
  },
  {
    title: "Fidelity Check",
    icon: "🟡",
    description:
      "Low mastery with low reteach = curriculum is being covered, not taught to mastery.",
    emptyMsg: "No fidelity concerns this week.",
    types: ["fidelity"],
    titleClass: "text-amber-700 dark:text-amber-300",
    cardClass: "bg-amber-50 dark:bg-amber-950/20",
    borderClass: "border-l-amber-500",
  },
];

function bucketize(
  priorities: PriorityItem[],
  types: PriorityItemType[],
): PriorityItem[] {
  const wanted = new Set(types);
  return priorities.filter((p) => wanted.has(p.type));
}

function weekLabelFromToday(): string {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - day + 1);
  return monday.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MondayDigestPage() {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Monday Digest</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = await getCoachingSnapshot(schoolId, currentYear.yearId);
  const weekLabel = weekLabelFromToday();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-[#1a3c5e] to-[#0d1b2a] p-6 text-white shadow-md">
        <h1 className="text-2xl font-bold tracking-tight">
          📋 Monday Coaching Digest
        </h1>
        <p className="mt-1 text-sm opacity-85">Week of {weekLabel}</p>
      </div>

      <div className="flex flex-wrap gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        <span>
          <strong>{snapshot.groupCount}</strong> groups tracked
        </span>
        <span>
          <strong>{snapshot.groupsWithReteach}</strong> with reteaches
        </span>
        <span>
          <strong>{snapshot.tier3Count}</strong> Tier 3 flags
        </span>
        <span>
          <strong>{snapshot.totalAbsences}</strong> missed sessions
        </span>
      </div>

      {snapshot.priorities.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
          <strong className="text-amber-900 dark:text-amber-300">
            ⚡ {snapshot.priorities.length} action item
            {snapshot.priorities.length !== 1 ? "s" : ""} this week
          </strong>
        </div>
      )}

      {BUCKETS.map((bucket) => {
        const items = bucketize(snapshot.priorities, bucket.types);
        return (
          <section key={bucket.title} className="space-y-3">
            <div>
              <h2 className={`text-lg font-bold ${bucket.titleClass}`}>
                {bucket.icon} {bucket.title}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {bucket.description}
              </p>
            </div>
            {items.length === 0 ? (
              <p className="text-sm italic text-zinc-400">
                ✓ {bucket.emptyMsg}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div
                    key={`${bucket.title}-${item.groupId}-${item.studentId ?? ""}-${i}`}
                    className={`rounded-lg border border-l-4 border-zinc-200 p-3 dark:border-zinc-800 ${bucket.cardClass} ${bucket.borderClass}`}
                  >
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.groupName}
                      {item.studentName && (
                        <span className="ml-1 font-normal text-zinc-600 dark:text-zinc-400">
                          · {item.studentName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {item.detail}
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold ${bucket.titleClass}`}
                    >
                      → {item.action}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        Generated from the Adira Reads coaching engine. Data window:{" "}
        {snapshot.windowDays} days. Aimline: 2 lessons/week. Section bridge
        detection active — mastery flags suppressed until min lessons
        attempted per section size.
      </div>
    </div>
  );
}
