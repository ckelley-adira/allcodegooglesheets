/**
 * @file page.tsx — Landing page for Adira Reads
 *
 * Public-facing root page. Authenticated users are redirected to the
 * dashboard; unauthenticated users see the sign-in prompt.
 */

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Adira Reads</h1>
      <p className="max-w-md text-center text-lg text-zinc-600 dark:text-zinc-400">
        Structured literacy progress tracking for TILT partner schools.
      </p>
      <a
        href="/login"
        className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Sign In
      </a>
    </main>
  );
}
