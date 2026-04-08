/**
 * @file dashboard/coaching/page.tsx — Coaching Priority Matrix
 *
 * Phase C.3b. The "Friday Dashboard" view: the Coaching Priority Matrix
 * composed from all four metrics (Reteach / Group Mastery / Growth /
 * Absence). Each priority item is a concrete action with an explanation
 * of why it fired.
 *
 * Role-gated to coach / school_admin / tilt_admin. Tutors see the
 * Student, Groups, and Session pages instead.
 */

import { requireRole } from "@/lib/auth";
import { getActiveSchoolId } from "@/lib/auth/school-context";
import { listAcademicYears } from "@/lib/dal/groups";
import {
  getCoachingSnapshot,
  type PriorityItemType,
} from "@/lib/dal/coaching";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<
  PriorityItemType,
  { label: string; badgeClass: string; borderClass: string }
> = {
  celebration: {
    label: "Celebration",
    badgeClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
    borderClass: "border-l-purple-500",
  },
  fasttrack: {
    label: "Speed Up",
    badgeClass:
      "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
    borderClass: "border-l-green-500",
  },
  coaching: {
    label: "Coaching Focus",
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    borderClass: "border-l-blue-500",
  },
  systemic: {
    label: "Systemic",
    badgeClass:
      "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
    borderClass: "border-l-red-500",
  },
  fidelity: {
    label: "Fidelity Check",
    badgeClass:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    borderClass: "border-l-amber-500",
  },
  tier3: {
    label: "MTSS Escalation",
    badgeClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    borderClass: "border-l-rose-600",
  },
};

export default async function CoachingPage() {
  const user = await requireRole("coach", "school_admin", "tilt_admin");
  const schoolId = await getActiveSchoolId(user);
  const years = await listAcademicYears(schoolId);
  const currentYear = years.find((y) => y.isCurrent);

  if (!currentYear) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Coaching</h1>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No active academic year for this school.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = await getCoachingSnapshot(schoolId, currentYear.yearId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Coaching</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Coaching Priority Matrix — reteach / mastery / growth / absence
          crossed into actionable items. Last {snapshot.windowDays} days.
        </p>
      </div>

      {/* Rollup cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Groups tracked
          </p>
          <p className="mt-1 text-3xl font-bold">{snapshot.groupCount}</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Active groups in this school
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            With reteaches
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              snapshot.groupsWithReteach > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-zinc-400",
            )}
          >
            {snapshot.groupsWithReteach}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Groups with at least one reteach
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tier 3 flags
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              snapshot.tier3Count > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-zinc-400",
            )}
          >
            {snapshot.tier3Count}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Students needing MTSS review
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Missed sessions
          </p>
          <p className="mt-1 text-3xl font-bold">{snapshot.totalAbsences}</p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Total absence rows in window
          </p>
        </div>
      </div>

      {/* Priority matrix */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Priority Matrix ({snapshot.priorities.length})
        </h2>
        {snapshot.priorities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            No priorities fired this week. Either everything is tracking
            within expected range, or data hasn&rsquo;t been captured yet.
          </div>
        ) : (
          <div className="space-y-2">
            {snapshot.priorities.map((p, i) => {
              const style = TYPE_STYLES[p.type];
              return (
                <div
                  key={`${p.type}-${p.groupId}-${p.studentId ?? ""}-${i}`}
                  className={cn(
                    "rounded-r-lg border border-l-4 border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
                    style.borderClass,
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{p.icon}</span>
                    <Badge className={style.badgeClass}>{style.label}</Badge>
                    <span className="text-sm font-semibold">{p.groupName}</span>
                    {p.studentName && (
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        · {p.studentName}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-mono text-zinc-400">
                      urgency {p.urgency}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {p.detail}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    → {p.action}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Aimline: 2 lessons/week (UFLI 2-day teach + Day 5 assessment cycle).
        Bridge detection: mastery flags suppressed until minimum lessons
        attempted per section size. Bridging sections (Blends) resolved to
        parent scope for stable measurement.
      </p>
    </div>
  );
}
