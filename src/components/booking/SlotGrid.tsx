"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormError } from "@/components/ui";
import { formatTime } from "@/lib/time";
import type { Slot } from "@/lib/types";
import { holdSlotAction } from "@/server/actions/booking";

type Props = { serviceId: string; slots: Slot[]; showTherapist: boolean; currentUrl: string };

const NETWORK_ERROR = "We couldn't reach the clinic. Check your connection and try again.";

export function SlotGrid({ serviceId, slots, showTherapist, currentUrl }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // One idempotency key per slot for this page view: retries and double clicks reuse it.
  const keys = useRef(new Map<string, string>());

  async function hold(slot: Slot) {
    if (inFlight.current) return;
    inFlight.current = true;
    const id = `${slot.therapistId}:${slot.startsAt}`;
    const idempotencyKey = keys.current.get(id) ?? crypto.randomUUID();
    keys.current.set(id, idempotencyKey);
    setPending(id);
    setError(null);

    try {
      const result = await holdSlotAction({ serviceId, therapistId: slot.therapistId, startsAt: slot.startsAt, idempotencyKey });
      if (result.ok) return router.push(`/book/hold/${result.data.appointmentId}`);
      if (result.needsSignIn) return router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
      setError(result.error);
      router.refresh(); // the slot list is probably out of date
    } catch {
      setError(NETWORK_ERROR);
    }
    inFlight.current = false;
    setPending(null);
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2" data-cy="slot-list">
        {slots.map((slot) => {
          const id = `${slot.therapistId}:${slot.startsAt}`;
          const time = formatTime(new Date(slot.startsAt));
          return (
            <li key={id}>
              <button
                type="button"
                data-cy="slot"
                data-starts-at={slot.startsAt}
                disabled={pending !== null}
                aria-busy={pending === id}
                aria-label={`${time} with ${slot.therapistName}`}
                onClick={() => hold(slot)}
                className="w-full rounded-lg border border-pine/30 bg-mint px-3 py-2.5 text-left transition hover:border-pine disabled:opacity-60 aria-busy:bg-pine aria-busy:text-pine-ink"
              >
                <span className="block text-lg font-bold tabular-nums">{pending === id ? "Holding…" : time}</span>
                {showTherapist && <span className="block truncate text-sm text-muted">{slot.therapistName}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
