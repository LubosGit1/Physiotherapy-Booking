"use client";

import { useState, useTransition } from "react";
import { Button, FormError } from "@/components/ui";
import { confirmBookingAction } from "@/server/actions/booking";

export function ConfirmBookingButton({ appointmentId }: { appointmentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <FormError message={error} />
      <Button
        data-cy="confirm-booking"
        disabled={pending}
        className="w-full px-6 py-3 text-lg sm:w-auto"
        onClick={() =>
          startTransition(async () => {
            const result = await confirmBookingAction(appointmentId);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Booking…" : "Confirm booking"}
      </Button>
    </div>
  );
}
