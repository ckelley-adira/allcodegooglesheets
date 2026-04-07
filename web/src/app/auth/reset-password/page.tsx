/**
 * @file reset-password/page.tsx — Set a new password from a reset link
 *
 * The user lands here from the email Supabase sends (the redirectTo URL
 * we passed to resetPasswordForEmail). The link includes a `code` query
 * param that we exchange for a recovery session before rendering the
 * password form.
 *
 * After the form is submitted, the user is graduated to a normal session
 * and redirected to the dashboard.
 */

import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";
import Link from "next/link";

interface ResetPasswordPageProps {
  searchParams: Promise<{ code?: string; error?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { code } = await searchParams;

  let exchangeError: string | null = null;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      exchangeError = error.message;
    }
  } else {
    exchangeError = "Missing reset code. Use the link in your email.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Adira Reads</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Set a new password
          </p>
        </div>

        {exchangeError ? (
          <div className="space-y-3 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <p className="font-semibold">Reset link invalid</p>
            <p>
              Your reset link is missing or has expired (links expire after 30
              minutes).
            </p>
            <p>
              <Link
                href="/forgot-password"
                className="font-medium underline hover:no-underline"
              >
                Request a new link
              </Link>
            </p>
          </div>
        ) : (
          <ResetPasswordForm />
        )}
      </div>
    </main>
  );
}
