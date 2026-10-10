import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-4xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="text-lg text-muted">The link may be old, or the booking may belong to another account.</p>
      <Link href="/book" className={buttonClass("primary")}>
        Book an appointment
      </Link>
    </div>
  );
}
