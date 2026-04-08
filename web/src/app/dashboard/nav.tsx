/**
 * @file dashboard/nav.tsx — Sidebar navigation for the dashboard
 *
 * Shows navigation items filtered by both the user's role (D-003) and
 * the active school's enabled feature flags. Items disabled by feature
 * flag are hidden entirely from the sidebar.
 *
 * Per D-014: MVP surfaces are group management, session capture, UFLI MAP,
 * and the Big Four dashboard.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AppMetadata } from "@/lib/auth";

interface NavItem {
  label: string;
  href: string;
  /** Minimum roles that can see this item (empty = all roles) */
  roles?: AppMetadata["role"][];
  /** Feature flag key required to show this item (empty = always visible) */
  requiresFlag?: string;
}

/** MVP navigation items — gated by role and (optionally) feature flag */
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Students", href: "/dashboard/students" },
  { label: "Groups", href: "/dashboard/groups" },
  {
    label: "Sessions",
    href: "/dashboard/sessions",
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "Assessments",
    href: "/dashboard/assessments",
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "Diagnostics",
    href: "/dashboard/diagnostics",
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "Coaching",
    href: "/dashboard/coaching",
    roles: ["coach", "school_admin", "tilt_admin"],
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "Bands",
    href: "/dashboard/bands",
    roles: ["coach", "school_admin", "tilt_admin"],
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "Monday Digest",
    href: "/dashboard/monday-digest",
    roles: ["coach", "school_admin", "tilt_admin"],
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "Snapshots",
    href: "/dashboard/snapshots",
    roles: ["school_admin", "tilt_admin"],
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "UFLI Map",
    href: "/dashboard/ufli-map",
    requiresFlag: "ufli_progress_tracking",
  },
  {
    label: "Staff",
    href: "/dashboard/staff",
    roles: ["school_admin", "tilt_admin"],
  },
  {
    label: "Schools",
    href: "/dashboard/schools",
    roles: ["tilt_admin"],
  },
  {
    label: "Network",
    href: "/dashboard/network",
    roles: ["tilt_admin"],
  },
];

interface DashboardNavProps {
  role: AppMetadata["role"];
  isTiltAdmin: boolean;
  featureFlags: Record<string, boolean>;
}

export function DashboardNav({
  role,
  isTiltAdmin,
  featureFlags,
}: DashboardNavProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    // Role gate
    if (item.roles && !isTiltAdmin && !item.roles.includes(role)) {
      return false;
    }
    // Feature flag gate
    if (item.requiresFlag && !featureFlags[item.requiresFlag]) {
      return false;
    }
    return true;
  });

  return (
    <nav className="flex flex-col gap-1 p-3">
      {visibleItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
