export type Role = "CLIENT" | "THERAPIST" | "ADMIN";

const PROTECTED: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/schedule", roles: ["THERAPIST"] },
  { prefix: "/appointments", roles: ["CLIENT"] },
  { prefix: "/book/hold", roles: ["CLIENT"] },
];

export type AccessDecision = "allow" | "sign-in" | "forbidden";

/** Route-level access used by middleware. Services re-check everything on the server. */
export function pageAccess(pathname: string, role: Role | null | undefined): AccessDecision {
  const rule = PROTECTED.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return "allow";
  if (!role) return "sign-in";
  return rule.roles.includes(role) ? "allow" : "forbidden";
}

export function homeFor(role: Role): string {
  return { CLIENT: "/appointments", THERAPIST: "/schedule", ADMIN: "/admin" }[role];
}

/** Only same-site relative paths, so ?callbackUrl= can't be used as an open redirect. */
export function safeCallbackUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  return value;
}
