import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-4xl font-extrabold">This page is for clinic staff</h1>
      <p className="text-lg text-muted">Your account doesn&apos;t have access to it. If you think it should, ask the clinic admin.</p>
      <Link href="/start" className={buttonClass("primary")}>
        Go to your home page
      </Link>
    </div>
  );
}
