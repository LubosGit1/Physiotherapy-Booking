"use client";

import { useId, useState, useTransition } from "react";
import { Button, FormError } from "@/components/ui";
import { cancelAppointmentAction } from "@/server/actions/booking";

type Props = { appointmentId: string; allowed: boolean; reason?: string; label?: string };

/** Two-step cancel: no browser dialog, and a disabled button always says why. */
export function CancelAppointment({ appointmentId, allowed, reason, label = "Cancel appointment" }: Props) {
  const reasonId = useId();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!allowed) {
    return (
      <div className="space-y-1">
        <Button variant="secondary" disabled aria-describedby={reasonId}>
          {label}
        </Button>
        <p id={reasonId} className="max-w-sm text-sm text-muted">
          {reason}
        </p>
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2" role="group" aria-label="Confirm cancellation">
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelAppointmentAction(appointmentId);
              if (!result.ok) setError(result.error);
            })
          }
        >
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
