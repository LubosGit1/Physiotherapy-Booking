import type { Metadata } from "next";
import Link from "next/link";
import { SlotGrid } from "@/components/booking/SlotGrid";
import { PageTitle } from "@/components/ui";
import { bookHref } from "@/lib/booking-url";
import { formatPrice } from "@/lib/money";
import { BOOKING_RULES, bookableDates } from "@/lib/policies";
import { dateToInstant, formatLongDay, isoWeekday } from "@/lib/time";
import { currentTime } from "@/server/clock";
import { getAvailability } from "@/server/services/availability";
import { listActiveServices, therapistsForService } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Book an appointment" };

type Props = { searchParams: Promise<{ service?: string; therapist?: string; date?: string }> };

const dayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", weekday: "short" });
const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", day: "numeric", month: "short" });

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

const optionClass = (selected: boolean) =>
  `block rounded-xl border px-4 py-3 transition ${
    selected ? "border-pine bg-mint ring-1 ring-pine" : "border-line bg-card hover:border-ink/40"
  }`;

export default async function BookPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = await currentTime();
  const services = await listActiveServices();
  const service = services.find((s) => s.id === params.service) ?? null;
  const therapists = service ? await therapistsForService(service.id) : [];
  const therapistId = therapists.some((t) => t.id === params.therapist) ? params.therapist : undefined;
  const dates = bookableDates(now);
  const date = params.date && dates.includes(params.date) ? params.date : dates[0];

  const availability = service ? await getAvailability({ serviceId: service.id, therapistId, date }, now) : null;
  const currentUrl = bookHref({ service: service?.id, therapist: therapistId, date });

  return (
    <>
      <PageTitle
        lead={`Times are in Prague time. When you pick one, we hold it for ${BOOKING_RULES.holdMinutes} minutes while you confirm.`}
      >
        Book an appointment
      </PageTitle>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="space-y-8">
          <Step title="Treatment">
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id}>
                  <Link
                    href={bookHref({ service: s.id, date })}
                    aria-current={s.id === service?.id ? "true" : undefined}
                    data-cy="service-option"
                    className={optionClass(s.id === service?.id)}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{s.name}</span>
                      <span className="tabular-nums">{formatPrice(s.priceCents)}</span>
                    </span>
                    <span className="block text-sm text-muted">{s.durationMin} minutes</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Step>

          {service && (
            <Step title="Therapist">
              <ul className="flex flex-wrap gap-2">
                {[{ id: undefined, name: "Any therapist", title: "First free time" }, ...therapists].map((t) => (
                  <li key={t.id ?? "any"}>
                    <Link
                      href={bookHref({ service: service.id, therapist: t.id, date })}
                      aria-current={t.id === therapistId ? "true" : undefined}
                      data-cy="therapist-option"
                      className={optionClass(t.id === therapistId)}
                    >
                      <span className="block font-bold">{t.name}</span>
                      <span className="block text-sm text-muted">{t.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Step>
          )}
        </div>

        <div className="min-w-0 space-y-8">
          {!service ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-lg text-muted">
              Choose a treatment to see free times. Not sure? Start with an initial assessment.
            </p>
          ) : (
            <>
              <Step title="Day">
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" data-cy="day-list">
                  {dates.map((d) => {
                    const instant = dateToInstant(d);
                    const weekend = isoWeekday(d) >= 6;
                    return (
                      <li key={d} className="shrink-0">
                        <Link
                          href={bookHref({ service: service.id, therapist: therapistId, date: d })}
                          aria-current={d === date ? "date" : undefined}
                          aria-label={formatLongDay(instant)}
                          data-cy="day-option"
                          data-date={d}
                          className={`flex w-16 flex-col items-center rounded-xl border py-2 ${
                            d === date ? "border-pine bg-pine text-pine-ink" : "border-line bg-card hover:border-ink/40"
                          } ${weekend && d !== date ? "text-muted" : ""}`}
                        >
                          <span className="text-sm">{dayFormat.format(instant)}</span>
                          <span className="text-lg font-bold tabular-nums">{dateFormat.format(instant).split(" ")[0]}</span>
                          <span className="text-xs">{dateFormat.format(instant).split(" ")[1]}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Step>

              <Step title={`Free times on ${formatLongDay(dateToInstant(date))}`}>
                {availability && availability.slots.length > 0 ? (
                  <SlotGrid
                    key={currentUrl}
                    serviceId={service.id}
                    slots={availability.slots}
                    showTherapist={!therapistId}
                    currentUrl={currentUrl}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-line p-6 text-muted" data-cy="no-slots">
                    {isoWeekday(date) >= 6
                      ? "The clinic is closed at weekends. Pick a weekday."
                      : "Nothing free on this day. Try the next day or another therapist."}
                  </p>
                )}
              </Step>
            </>
          )}
        </div>
      </div>
    </>
  );
}
