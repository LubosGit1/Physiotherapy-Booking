import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { bookHref } from "@/lib/booking-url";
import { formatPrice } from "@/lib/money";
import { bookableDates } from "@/lib/policies";
import { formatDay, formatTime } from "@/lib/time";
import { CLINIC } from "@/server/email/templates";
import type { Slot } from "@/lib/types";
import { currentTime } from "@/server/clock";
import { getAvailability } from "@/server/services/availability";
import { listActiveServices } from "@/server/services/catalog";

/** The first free times for a service, looking ahead day by day. */
async function nextFreeSlots(serviceId: string, now: Date, wanted = 4) {
  const found: (Slot & { date: string })[] = [];
  for (const date of bookableDates(now)) {
    const { slots } = await getAvailability({ serviceId, date }, now);
    found.push(...slots.map((s) => ({ ...s, date })));
    if (found.length >= wanted) break;
  }
  return found.slice(0, wanted);
}

export default async function HomePage() {
  const now = await currentTime();
  const services = await listActiveServices();
  const featured = services.find((s) => s.name === "Initial assessment") ?? services[0];
  const slots = featured ? await nextFreeSlots(featured.id, now) : [];

  return (
    <div className="space-y-20">
      <section className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <h1 className="text-5xl font-extrabold sm:text-7xl">Motion physiotherapy.<br />Book in a minute.</h1>
          <p className="max-w-[48ch] text-xl text-muted">
            Back and neck pain, sports injuries, recovery after surgery. Pick a therapist and a time that suits you,
            and get a confirmation by email.
          </p>
          <Link href="/book" className={buttonClass("primary", "px-6 py-3 text-lg")}>
            See all free times
          </Link>
        </div>

        {featured && slots.length > 0 && (
          <div className="rounded-2xl border border-line bg-card p-5" data-cy="next-free">
            <h2 className="text-lg font-bold">Next free {featured.name.toLowerCase()}</h2>
            <p className="mb-4 text-muted">
              {featured.durationMin} minutes, {formatPrice(featured.priceCents)}
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <li key={`${slot.therapistId}${slot.startsAt}`}>
                  <Link
                    href={bookHref({ service: featured.id, therapist: slot.therapistId, date: slot.date })}
                    className="block rounded-lg border border-pine/30 bg-mint px-3 py-2 hover:border-pine"
                  >
                    <span className="block font-bold">
                      {formatDay(new Date(slot.startsAt))}, {formatTime(new Date(slot.startsAt))}
                    </span>
                    <span className="block text-sm text-muted">{slot.therapistName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="treatments" className="space-y-6">
        <h2 id="treatments" className="text-3xl font-extrabold">
          Treatments
        </h2>
        <ul className="grid gap-6 sm:grid-cols-3">
          {services.map((s) => (
            <li key={s.id} className="border-t-2 border-ink pt-4">
              <h3 className="text-xl font-bold">{s.name}</h3>
              <p className="text-muted">
                {s.durationMin} minutes, {formatPrice(s.priceCents)}
              </p>
              {s.description && <p className="mt-2">{s.description}</p>}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-line pt-6 text-muted">
        {CLINIC.name}, {CLINIC.address}.
        {/* Phone {CLINIC.phone}. */}
      </footer>
    </div>
  );
}
