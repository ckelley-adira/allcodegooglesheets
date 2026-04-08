/**
 * @file grants/page.tsx — Grants Center landing (Phase D.5f)
 *
 * Template picker. Shows the available Tier 1 grant report templates
 * with a brief description, target audience, and a link to open each
 * one. Role-gated to school_admin + tilt_admin.
 *
 * New templates added to the registry below will surface automatically
 * as new cards — no changes to this file needed beyond extending the
 * TEMPLATES array.
 */

import Link from "next/link";
import { requireRole } from "@/lib/auth";

interface TemplateCard {
  id: string;
  name: string;
  href: string;
  audience: string;
  description: string;
  piiNote: string;
  piiTone: "pii-ok" | "de-identified";
  sections: string[];
  status: "live" | "planned";
}

const TEMPLATES: TemplateCard[] = [
  {
    id: "mind-trust",
    name: "Mind Trust Tutoring Grant",
    href: "/dashboard/grants/mind-trust",
    audience: "Mind Trust · tutoring-dosage funders",
    description:
      "Per-student named report with attendance, baseline vs. current skill data, growth, identified gaps, and instructional adjustment recommendations mapped to UFLI lesson ranges.",
    piiNote: "Named students · PII-OK",
    piiTone: "pii-ok",
    sections: [
      "Attendance Rate",
      "Baseline vs Current",
      "Growth Percentages",
      "Skill Gaps",
      "Instructional Adjustments",
    ],
    status: "live",
  },
  {
    id: "impact",
    name: "Aggregate Impact Report",
    href: "/dashboard/grants/impact",
    audience: "Lilly Endowment · NSVF · Mind Trust · impact funders",
    description:
      "De-identified aggregate report with band + archetype distributions, school-wide growth deltas, movement breakdown, and a funder-ready methodology note. Safe to share externally.",
    piiNote: "De-identified · no student names",
    piiTone: "de-identified",
    sections: [
      "Hero Summary",
      "School-Wide Growth",
      "Band Distribution",
      "Archetype Distribution",
      "Movement Breakdown",
      "Gap Prevalence",
      "Methodology",
    ],
    status: "live",
  },
  {
    id: "executive-one-pager",
    name: "Executive One-Pager",
    href: "#",
    audience: "Board meetings · family foundations · small funders",
    description:
      "Single-page hero numbers + three story beats + one or two named-student spotlights (media-release consent required). Designed to hand to someone who has 60 seconds to care about the program.",
    piiNote: "Requires media release consent per student shown",
    piiTone: "pii-ok",
    sections: ["Hero metrics", "Narrative beats", "Student spotlight"],
    status: "planned",
  },
  {
    id: "network-impact",
    name: "Network Impact Report",
    href: "#",
    audience: "TILT Admin · scale/replication funders (NSVF-style)",
    description:
      "Multi-school cross-site variance analysis with per-site comparisons, archetype-distribution-over-time, and tutor value-add residuals. TILT Admin only.",
    piiNote: "De-identified · multi-school",
    piiTone: "de-identified",
    sections: [
      "Network summary",
      "Per-site comparison",
      "Archetype distribution over time",
      "Tutor value-add",
    ],
    status: "planned",
  },
  {
    id: "quarterly-narrative",
    name: "Quarterly Narrative",
    href: "#",
    audience: "Any funder · annual reports · board packets",
    description:
      "Auto-generated prose summary of the quarter's wins, movers, and flags. Human-reviewed before send. Combines highlights feed, band movement, and cliff crossings into a readable story.",
    piiNote: "De-identified · narrative format",
    piiTone: "de-identified",
    sections: ["Quarter summary", "Top wins", "Flags to discuss"],
    status: "planned",
  },
];

export default async function GrantsCenterPage() {
  await requireRole("school_admin", "tilt_admin");

  const liveTemplates = TEMPLATES.filter((t) => t.status === "live");
  const plannedTemplates = TEMPLATES.filter((t) => t.status === "planned");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Grants Center</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Funder-ready report templates. One data composer, multiple
          audience-specific views. Each template is print-optimized — use
          Cmd-P / the Print button to save as PDF.
        </p>
      </div>

      {/* Available templates */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Available ({liveTemplates.length})
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {liveTemplates.map((t) => (
            <TemplateCardLink key={t.id} template={t} />
          ))}
        </div>
      </section>

      {/* Planned templates */}
      {plannedTemplates.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Planned — Tier 2+
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            These templates are designed and will land in future phases.
            They&rsquo;re listed here so you know what&rsquo;s coming and
            can push priorities.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {plannedTemplates.map((t) => (
              <TemplateCardLink key={t.id} template={t} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        <p className="font-semibold text-zinc-700 dark:text-zinc-300">
          How this works
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Pick a template. Each one is tuned to a different funder
            archetype — Mind Trust is named-student, Aggregate Impact is
            de-identified, and so on.
          </li>
          <li>
            Set filters inside the template (grades, lookback window). The
            filter state lives in the URL so you can bookmark or share a
            specific view with a coach.
          </li>
          <li>
            Click <strong>Print / Save as PDF</strong> in the top-right of
            the template. The print CSS hides the sidebar, filter bar, and
            breadcrumb, and formats tables to flow across pages cleanly.
          </li>
          <li>
            All reports read from one shared data composer — when the
            underlying metrics change, every template updates.
          </li>
        </ol>
      </section>
    </div>
  );
}

function TemplateCardLink({ template }: { template: TemplateCard }) {
  const isLive = template.status === "live";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold tracking-tight">{template.name}</h3>
        {isLive ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-800 dark:bg-green-950/40 dark:text-green-300">
            Live
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Planned
          </span>
        )}
      </div>
      <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {template.audience}
      </p>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        {template.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.sections.map((s) => (
          <span
            key={s}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {s}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={
            template.piiTone === "pii-ok"
              ? "text-[11px] font-medium text-amber-700 dark:text-amber-400"
              : "text-[11px] font-medium text-blue-700 dark:text-blue-400"
          }
        >
          {template.piiNote}
        </span>
        {isLive && (
          <span className="text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">
            Open →
          </span>
        )}
      </div>
    </>
  );

  if (isLive) {
    return (
      <Link
        href={template.href}
        className="group block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
      {body}
    </div>
  );
}
