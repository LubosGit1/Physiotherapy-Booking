import type { Metadata } from "next";
import { RegisterForm } from "@/components/forms/AuthForms";
import { safeCallbackUrl } from "@/lib/access";

export const metadata: Metadata = { title: "Create an account" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl) ?? undefined;
  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold">Create an account</h1>
      <p className="mb-6 text-muted">You need one to book and manage your appointments.</p>
      <RegisterForm callbackUrl={callbackUrl} />
    </>
  );
}
