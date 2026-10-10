import type { Metadata } from "next";
import Link from "next/link";
import { CancelAppointment } from "@/components/booking/CancelAppointment";
import { DeleteTimeOffButton, TimeOffForm } from "@/components/forms/ClinicForms";
import { PageTitle } from "@/components/ui";
import { addDays, CLINIC_TIME_ZONE, dateToInstant, formatDateTime, formatLongDay, formatTime, isValidDate, localDate, startOfWeek } from "@/lib/time";
import { currentTime } from "@/server/clock";
import { getTherapistWeek } from "@/server/services/schedule";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "My schedule" };

type Props = { searchParams: Promise<{ week?: string }> };

export default async function SchedulePage({ searchParams }: Props) {
  const { week } = await searchParams;
  const now = await currentTime();
  const today = localDate(now.getTime(), CLINIC_TIME_ZONE);
  const weekStart = startOfWeek(week && isValidDate(week) ? week : today);
  const { sessions, absences } = await getTherapistWeek(await getViewer(), weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <PageTitle lead="Booked sessions for the week. Add time off and those hours disappear from online booking.">My schedule</PageTitle>

      <nav aria-label="Week" className="mb-6 flex items-center gap-4">
        <Link href={`/schedule?week=${addDays(weekStart, -7)}`} className="font-semibold underline-offset-4 hover:underline">
          Previous week
        </Link>
        <span className="font-bold" data-cy="week-label">
          Week of {formatLongDay(dateToInstant(weekStart))}
        </span>
        <Link href={`/schedule?week=${addDays(weekStart, 7)}`} className="font-semibold underline-offset-4 hover:underline">
          Next week
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <ol className="space-y-6">
          {days.map((day) => {
            const items = sessions.filter((s) => localDate(s.startsAt.getTime(), CLINIC_TIME_ZONE) === day);
            return (
              <li key={day} data-cy="schedule-day" data-date={day}>
                <h2 className="mb-2 text-lg font-bold">{formatLongDay(dateToInstant(day))}</h2>
                {items.length === 0 ? (
                  <p className="text-muted">No sessions.</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((s) => (
                      <li key={s.id} data-cy="session" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
                        <div>
                          <p className="font-bold tabular-nums">
                            {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                          </p>
                          <p className="text-muted">
                            {s.serviceName}, {s.clientName}
                          </p>
                        </div>
                        <CancelAppointment appointmentId={s.id} allowed label="Cancel session" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <aside className="space-y-8">
          <section className="space-y-4 rounded-2xl border border-line bg-card p-5">
            <h2 className="text-xl font-bold">Add time off</h2>
            <TimeOffForm />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold">Time off this week</h2>
            {absences.length === 0 ? (
              <p className="text-muted">None.</p>
            ) : (
              <ul className="space-y-2">
                {absences.map((a) => (
                  <li key={a.id} data-cy="time-off" className="flex items-start justify-between gap-2 rounded-xl border border-line px-4 py-3">
                    <span>
                      {formatDateTime(a.startsAt)} until {formatDateTime(a.endsAt)}
                      {a.reason && <span className="block text-sm text-muted">{a.reason}</span>}
                    </span>
                    <DeleteTimeOffButton id={a.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
