/**
 * @file forgot-password/page.tsx — Password reset request page
 *
 * Email input → submits to requestPasswordResetAction → success message
 * tells the user to check their inbox. The success state intentionally
 * doesn't reveal whether the email exists in the system, to avoid
 * enumeration attacks.
 */

"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordResetAction,
  type ForgotPasswordFormState,
} from "./actions";

const initialState: ForgotPasswordFormState = { error: null, success: false };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Adira Reads</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Reset your password
          </p>
        </div>

        {state.success ? (
          <div className="space-y-4 rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/50 dark:text-green-300">
            <p className="font-semibold">Check your email</p>
            <p>
              If an account exists for that address, we just sent a password
              reset link. The link will expire in 30 minutes.
            </p>
            <p>
              <Link
                href="/login"
                className="font-medium underline hover:no-underline"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Enter the email address you signed in with. We&apos;ll send you
              a link to set a new password.
            </p>

            {state.error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
                placeholder="you@school.org"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? "Sending..." : "Send reset link"}
            </button>

            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Remembered it?{" "}
              <Link
                href="/login"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
