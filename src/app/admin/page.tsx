import type { Metadata } from "next";
import Link from "next/link";
import { CancelAppointment } from "@/components/booking/CancelAppointment";
import { NewServiceForm, ServiceActiveToggle } from "@/components/forms/ClinicForms";
import { PageTitle } from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { addDays, CLINIC_TIME_ZONE, dateToInstant, formatLongDay, formatTime, isValidDate, localDate } from "@/lib/time";
import { currentTime } from "@/server/clock";
import { listDayAppointments } from "@/server/services/bookings";
import { listAllServices, listTherapists } from "@/server/services/catalog";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Clinic admin" };

type Props = { searchParams: Promise<{ date?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const { date: requested } = await searchParams;
  const viewer = await getViewer();
  const today = localDate((await currentTime()).getTime(), CLINIC_TIME_ZONE);
  const date = requested && isValidDate(requested) ? requested : today;
  const [day, services, therapists] = await Promise.all([
    listDayAppointments(viewer, date),
    listAllServices(viewer),
    listTherapists(),
  ]);

  return (
    <>
      <PageTitle>Clinic admin</PageTitle>

      <section className="space-y-4" aria-labelledby="day-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="day-heading" className="text-2xl font-bold">
            {formatLongDay(dateToInstant(date))}
          </h2>
          <nav aria-label="Day" className="flex gap-4">
            <Link href={`/admin?date=${addDays(date, -1)}`} className="font-semibold underline-offset-4 hover:underline">
              Previous day
            </Link>
            <Link href={`/admin?date=${addDays(date, 1)}`} className="font-semibold underline-offset-4 hover:underline">
              Next day
            </Link>
          </nav>
        </div>
        {day.length === 0 ? (
          <p className="text-muted">No appointments on this day.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Time</th>
                  <th className="px-4 py-2 font-semibold">Therapist</th>
                  <th className="px-4 py-2 font-semibold">Client</th>
                  <th className="px-4 py-2 font-semibold">Treatment</th>
                  <th className="px-4 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {day.map((a) => (
                  <tr key={a.id} data-cy="admin-appointment">
                    <td className="px-4 py-3 font-bold tabular-nums">
                      {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                    </td>
                    <td className="px-4 py-3">{a.therapistName}</td>
                    <td className="px-4 py-3">
                      {a.clientName}
                      <span className="block text-sm text-muted">{a.clientEmail}</span>
                    </td>
                    <td className="px-4 py-3">{a.serviceName}</td>
                    <td className="px-4 py-3 text-right">
                      <CancelAppointment appointmentId={a.id} allowed label="Cancel" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-14 space-y-4" aria-labelledby="services-heading">
        <h2 id="services-heading" className="text-2xl font-bold">
          Services
        </h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {services.map((s) => (
            <li key={s.id} data-cy="admin-service" className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-bold">
                  {s.name}
                  {!s.active && <span className="ml-2 font-medium text-muted">(not offered)</span>}
                </p>
                <p className="text-sm text-muted">
                  {s.durationMin} min, {formatPrice(s.priceCents)}, {s.therapistNames.join(" and ")}
                </p>
              </div>
              <ServiceActiveToggle id={s.id} name={s.name} active={s.active} />
            </li>
          ))}
        </ul>
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="mb-4 text-xl font-bold">Add a service</h3>
          <NewServiceForm therapists={therapists} />
        </div>
      </section>
    </>
  );
}
