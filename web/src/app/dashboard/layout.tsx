/**
 * @file dashboard/layout.tsx — Authenticated layout shell
 *
 * Wraps all /dashboard/* routes with a sidebar nav and top bar.
 * Requires authentication — unauthenticated users are redirected by proxy.ts.
 * The nav items shown depend on the user's role (D-003).
 */

import { requireAuth } from "@/lib/auth";
import { DashboardNav } from "./nav";
import { UserMenu } from "./user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <div className="flex h-14 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
          <span className="text-sm font-bold tracking-tight">Adira Reads</span>
        </div>
        <DashboardNav role={user.role} isTiltAdmin={user.isTiltAdmin} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800 md:px-6">
          {/* Mobile nav trigger placeholder */}
          <div className="md:hidden">
            <span className="text-sm font-bold tracking-tight">Adira Reads</span>
          </div>
          <div className="hidden md:block" />
          <UserMenu email={user.email} role={user.role} />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
