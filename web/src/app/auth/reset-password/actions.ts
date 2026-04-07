/**
 * @file reset-password/actions.ts — Apply a new password
 *
 * Called by the reset-password page after the user has been signed in
 * via the recovery link (the page handles the code → session exchange
 * before showing the form). The user is in a temporary recovery session,
 * so updateUser() with a password applies it to their account and
 * graduates them to a normal session.
 *
 * @actionType mutation
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ResetPasswordFormState {
  error: string | null;
}

export async function applyPasswordResetAction(
  _prevState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Your reset link has expired or is invalid. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
