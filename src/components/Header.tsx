import Link from "next/link";
import { getViewer } from "@/server/viewer";
import { signOutAction } from "@/server/actions/auth";
import { Wordmark } from "./ui";

const NAV = {
  CLIENT: [
    { href: "/book", label: "Book" },
    { href: "/appointments", label: "My appointments" },
  ],
  THERAPIST: [{ href: "/schedule", label: "My schedule" }],
  ADMIN: [
    { href: "/admin", label: "Clinic admin" },
    { href: "/book", label: "Booking page" },
  ],
} as const;

export async function Header() {
  const viewer = await getViewer();
  const links = viewer ? NAV[viewer.role] : [{ href: "/book", label: "Book" }];

  return (
    <header className="border-b border-line bg-card/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" aria-label="Motion Physiotherapy home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="font-medium underline-offset-4 hover:underline">
              {link.label}
            </Link>
          ))}
          {viewer ? (
            <form action={signOutAction} className="flex items-center gap-3">
              <span className="hidden text-sm text-muted md:inline" data-cy="signed-in-as">
                {viewer.name}
              </span>
              <button type="submit" className="font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="font-medium underline-offset-4 hover:underline">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
