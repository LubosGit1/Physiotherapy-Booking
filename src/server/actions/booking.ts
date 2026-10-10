"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionResult } from "@/lib/types";
import { deliverPendingEmails } from "@/server/email/outbox";
import { cancelAppointment, confirmBooking, holdSlot, releaseHold } from "@/server/services/bookings";
import { runAction } from "./run-action";

export type HoldInput = { serviceId: string; therapistId: string; startsAt: string; idempotencyKey: string };

export async function holdSlotAction(input: HoldInput): Promise<ActionResult<{ appointmentId: string }> & { needsSignIn?: boolean }> {
  const result = await runAction(async ({ viewer, now }) => {
    if (!viewer) return null;
    const hold = await holdSlot(viewer, input, now);
    return { appointmentId: hold.appointmentId };
  });
  if (result.ok && result.data === null) return { ok: false, error: "Sign in to book.", needsSignIn: true };
  return result as ActionResult<{ appointmentId: string }>;
}

export async function confirmBookingAction(appointmentId: string): Promise<ActionResult> {
  const result = await runAction(({ viewer, now }) => confirmBooking(viewer, appointmentId, now));
  if (!result.ok) return result;
  after(() => deliverPendingEmails());
  revalidatePath("/appointments");
  redirect(`/appointments?booked=${appointmentId}`);
}

export async function releaseHoldAction(appointmentId: string, backTo: string) {
  await runAction(({ viewer }) => releaseHold(viewer, appointmentId));
  redirect(backTo.startsWith("/book") ? backTo : "/book");
}

export async function cancelAppointmentAction(appointmentId: string): Promise<ActionResult> {
  const result = await runAction(({ viewer, now }) => cancelAppointment(viewer, appointmentId, now));
  if (result.ok) {
    after(() => deliverPendingEmails());
    revalidatePath("/", "layout");
  }
  return result;
}
