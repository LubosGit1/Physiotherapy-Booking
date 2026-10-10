import type { Metadata } from "next";
import { headers } from "next/headers";
import { LoginForm } from "@/components/forms/AuthForms";
import { safeCallbackUrl } from "@/lib/access";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

/**
 * Middleware passes an absolute callbackUrl for this site. Keep it only if it really
 * points here, and only as a path – anything else could be an open redirect.
 */
function toPath(value: string | undefined, host: string | null) {
  if (!value) return undefined;
  if (value.startsWith("/")) return safeCallbackUrl(value) ?? undefined;
  try {
    const url = new URL(value);
    if (!host || url.host !== host) return undefined;
    return safeCallbackUrl(url.pathname + url.search) ?? undefined;
  } catch {
    return undefined;
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const callbackUrl = toPath((await searchParams).callbackUrl, (await headers()).get("host"));
  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">Sign in</h1>
      <p className="mb-6 text-muted">{callbackUrl?.startsWith("/book") ? "Sign in to hold your time." : "Welcome back."}</p>
      <LoginForm callbackUrl={callbackUrl} />
    </>
  );
}
