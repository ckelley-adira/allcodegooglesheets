/**
 * @file auth/confirm/page.tsx — Email confirmation notice
 *
 * Shown after signup to tell the user to check their email.
 */

import Link from "next/link";

export default function ConfirmPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          We sent you a confirmation link. Click it to activate your account,
          then come back here to sign in.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Back to Sign In
        </Link>
      </div>
    </main>
  );
}
