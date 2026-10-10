import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HoldCountdown } from "@/components/booking/HoldCountdown";
import { ConfirmBookingButton } from "@/components/booking/HoldActions";
import { buttonClass } from "@/components/ui";
import { NotFoundError } from "@/lib/errors";
import { formatPrice } from "@/lib/money";
import { formatLongDay, formatTime } from "@/lib/time";
import { releaseHoldAction } from "@/server/actions/booking";
import { currentTime } from "@/server/clock";
import { getHold } from "@/server/services/bookings";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Confirm your booking" };

type Props = { params: Promise<{ id: string }> };

export default async function HoldPage({ params }: Props) {
  const { id } = await params;
  const hold = await getHold(await getViewer(), id, await currentTime()).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const summary = (
    <dl className="grid gap-x-8 gap-y-3 rounded-2xl border border-line bg-card p-6 sm:grid-cols-2" data-cy="hold-summary">
      {[
        ["Treatment", `${hold.serviceName}, ${hold.durationMin} minutes`],
        ["Therapist", hold.therapistName],
        ["When", `${formatLongDay(hold.startsAt)} at ${formatTime(hold.startsAt)}`],
        ["Price", `${formatPrice(hold.priceCents)}, paid at the clinic`],
      ].map(([term, value]) => (
        <div key={term}>
          <dt className="text-sm text-muted">{term}</dt>
          <dd className="text-lg font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );

  if (hold.state === "confirmed") {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-4xl font-extrabold">This appointment is booked</h1>
        {summary}
        <Link href="/appointments" className={buttonClass("primary")}>
          See my appointments
        </Link>
      </div>
    );
  }

  if (hold.state !== "active") {
    return (
      <div className="max-w-2xl space-y-6" data-cy="hold-expired">
        <h1 className="text-4xl font-extrabold">Your hold has run out</h1>
        <p className="text-lg text-muted">
          We keep a time for 10 minutes. This one has been released, so someone else may have booked it.
        </p>
        <Link href="/book" className={buttonClass("primary")}>
          Pick a time again
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold">We&apos;re holding this time for you</h1>
        <HoldCountdown expiresAt={hold.holdExpiresAt!.toISOString()} />
      </div>
      {summary}
      <div className="flex flex-wrap items-start gap-4">
        <ConfirmBookingButton appointmentId={hold.id} />
        <form action={releaseHoldAction.bind(null, hold.id, "/book")}>
          <button type="submit" className={buttonClass("ghost", "py-3")}>
            Choose a different time
          </button>
        </form>
      </div>
      <p className="text-muted">You can cancel online up to 24 hours before the appointment.</p>
    </div>
  );
}
