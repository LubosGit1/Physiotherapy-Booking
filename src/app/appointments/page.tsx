import type { Metadata } from "next";
import Link from "next/link";
import { CancelAppointment } from "@/components/booking/CancelAppointment";
import { buttonClass, FormSuccess, PageTitle } from "@/components/ui";
import { formatLongDay, formatTime } from "@/lib/time";
import { currentTime } from "@/server/clock";
import { listClientAppointments, type ClientAppointment } from "@/server/services/bookings";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "My appointments" };

type Props = { searchParams: Promise<{ booked?: string }> };

function When({ appointment }: { appointment: ClientAppointment }) {
  return (
    <p className="text-lg font-bold">
      {formatLongDay(appointment.startsAt)}, {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
    </p>
  );
}

export default async function AppointmentsPage({ searchParams }: Props) {
  const { booked } = await searchParams;
  const { upcoming, past } = await listClientAppointments(await getViewer(), await currentTime());
  const justBooked = upcoming.find((a) => a.id === booked);

  return (
    <>
      <PageTitle>My appointments</PageTitle>
      {justBooked && (
        <div className="mb-8">
          <FormSuccess message={`You're booked for ${formatLongDay(justBooked.startsAt)} at ${formatTime(justBooked.startsAt)}. We've emailed you the details.`} />
        </div>
      )}

      <section className="space-y-4" aria-labelledby="upcoming">
        <h2 id="upcoming" className="text-2xl font-bold">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="space-y-4 rounded-xl border border-dashed border-line p-6">
            <p className="text-muted">You have nothing booked.</p>
            <Link href="/book" className={buttonClass("primary")}>
              Book an appointment
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <li key={a.id} data-cy="upcoming-appointment" className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-card p-5">
                <div>
                  <When appointment={a} />
                  <p className="text-muted">
                    {a.serviceName} with {a.therapistName}
                  </p>
                </div>
                <CancelAppointment appointmentId={a.id} allowed={a.cancel.allowed} reason={a.cancel.allowed ? undefined : a.cancel.reason} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-12 space-y-4" aria-labelledby="history">
          <h2 id="history" className="text-2xl font-bold">
            History
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {past.map((a) => (
              <li key={a.id} data-cy="past-appointment" className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                <span>
                  {formatLongDay(a.startsAt)}, {formatTime(a.startsAt)}: {a.serviceName} with {a.therapistName}
                </span>
                <span className={a.status === "CANCELLED" ? "font-semibold text-danger" : "text-muted"}>
                  {a.status === "CANCELLED" ? "Cancelled" : "Attended"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
