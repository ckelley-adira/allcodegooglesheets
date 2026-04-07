/**
 * @file forgot-password/actions.ts — Password reset request action
 *
 * Calls supabase.auth.resetPasswordForEmail() with a redirectTo URL that
 * lands on /auth/reset-password. Supabase emails the user a magic link
 * (default expiry 1 hour, configured to 30 minutes per Christina's spec
 * via the Supabase dashboard's URL Configuration → "Reset password" OTP
 * expiry setting).
 *
 * Always returns success (even if the email doesn't exist) to avoid
 * leaking which emails are registered.
 *
 * @actionType mutation
 */

"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface ForgotPasswordFormState {
  error: string | null;
  success: boolean;
}

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) {
    return { error: "Email is required.", success: false };
  }

  // Build the absolute redirect URL from the request's host header so it
  // works in any environment (local dev, preview deploys, production)
  // without hard-coding the domain.
  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  const redirectTo = `${protocol}://${host}/auth/reset-password`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  // Don't surface the error to the client even on failure — that would
  // leak whether the email exists. Just log it server-side.
  if (error) {
    console.error("Password reset request failed:", {
      email,
      message: error.message,
    });
  }

  return { error: null, success: true };
}
