/**
 * @file dashboard/page.tsx — Dashboard home page
 *
 * Landing page after login. Will eventually show the Big Four metrics
 * (D-006, D-014). For now, a placeholder confirming auth works.
 */

import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Welcome back, {user.email}. The Big Four metrics dashboard will be built here.
      </p>

      {/* Placeholder cards for the Big Four — structure only, no data yet */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Foundational Skills", desc: "L1\u2013L34 mastery" },
          { title: "Min Grade Skills", desc: "MTSS metric by grade" },
          { title: "Current Year Progress", desc: "This year\u2019s curriculum" },
          { title: "Growth vs. Expected", desc: "4-week rolling slope" },
        ].map((metric) => (
          <div
            key={metric.title}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {metric.title}
            </p>
            <p className="mt-1 text-2xl font-bold">&mdash;</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {metric.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
