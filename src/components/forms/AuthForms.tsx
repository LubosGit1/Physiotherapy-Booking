"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormError } from "@/components/ui";
import { loginAction, registerAction } from "@/server/actions/auth";

const withCallback = (path: string, callbackUrl?: string) =>
  callbackUrl ? `${path}?callbackUrl=${encodeURIComponent(callbackUrl)}` : path;

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4" data-cy="login-form">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <FormError message={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-muted">
        First visit?{" "}
        <Link href={withCallback("/register", callbackUrl)} className="font-semibold text-pine underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(registerAction, {});
  return (
    <form action={action} className="space-y-4" data-cy="register-form" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field label="Full name" name="name" autoComplete="name" defaultValue={state.values?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." />
      <FormError message={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating your account…" : "Create account"}
      </Button>
      <p className="text-center text-muted">
        Already registered?{" "}
        <Link href={withCallback("/login", callbackUrl)} className="font-semibold text-pine underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
