"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { safeCallbackUrl } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { currentTime } from "@/server/clock";
import { LOGIN_LIMIT, loginKey, peekRateLimit } from "@/server/rate-limit";
import { registerClient } from "@/server/services/users";
import { formValue } from "./run-action";

/** `values` refill the form after a failed submit (React resets form fields after an action). */
export type AuthFormState = { error?: string; values?: { name?: string; email?: string } };

export async function loginAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = formValue(formData, "email");
  try {
    await signIn("credentials", {
      email,
      password: formValue(formData, "password"),
      redirectTo: safeCallbackUrl(formValue(formData, "callbackUrl")) ?? "/start",
    });
    return {};
  } catch (error) {
    if (!(error instanceof AuthError)) throw error; // the success redirect is thrown and must propagate
    const limit = await peekRateLimit(loginKey(email), LOGIN_LIMIT, await currentTime());
    if (!limit.allowed) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      return { error: `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, values: { email } };
    }
    return { error: "That email and password don't match.", values: { email } };
  }
}

export async function registerAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const credentials = { email: formValue(formData, "email"), password: formValue(formData, "password") };
  try {
    await registerClient({ ...credentials, name: formValue(formData, "name") });
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message, values: { name: formValue(formData, "name"), email: credentials.email } };
    }
    throw error;
  }
  await signIn("credentials", {
    ...credentials,
    redirectTo: safeCallbackUrl(formValue(formData, "callbackUrl")) ?? "/book",
  });
  return {};
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
