/**
 * @file dashboard/nav.tsx — Sidebar navigation for the dashboard
 *
 * Shows navigation items filtered by the user's role.
 * Per D-003: tutor, coach, school_admin, tilt_admin each see different items.
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
}

/** MVP navigation items — will expand as features are built */
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Students", href: "/dashboard/students" },
  { label: "Groups", href: "/dashboard/groups" },
  { label: "Sessions", href: "/dashboard/sessions" },
  { label: "UFLI Map", href: "/dashboard/ufli-map" },
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
];

interface DashboardNavProps {
  role: AppMetadata["role"];
  isTiltAdmin: boolean;
}

export function DashboardNav({ role, isTiltAdmin }: DashboardNavProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (isTiltAdmin) return true;
    return item.roles.includes(role);
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
