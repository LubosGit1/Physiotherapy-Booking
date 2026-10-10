import { addDays, CLINIC_TIME_ZONE, HOUR, localDate, MINUTE } from "./time";

/** Business rules in one place, so the UI explains exactly what the server enforces. */
export const BOOKING_RULES = {
  slotStepMinutes: 15,
  minLeadMinutes: 120,
  bookingWindowDays: 14,
  holdMinutes: 10,
  cancellationCutoffHours: 24,
} as const;

export const holdExpiry = (now: Date) => new Date(now.getTime() + BOOKING_RULES.holdMinutes * MINUTE);

export function bookableDates(now: Date): string[] {
  const today = localDate(now.getTime(), CLINIC_TIME_ZONE);
  return Array.from({ length: BOOKING_RULES.bookingWindowDays }, (_, i) => addDays(today, i));
}

export function isBookableDate(date: string, now: Date): boolean {
  return bookableDates(now).includes(date);
}

export type CancelDecision = { allowed: true } | { allowed: false; reason: string };

export function clientCancellation(startsAt: Date, now: Date): CancelDecision {
  if (startsAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: "This appointment has already started." };
  }
  const hoursLeft = (startsAt.getTime() - now.getTime()) / HOUR;
  if (hoursLeft < BOOKING_RULES.cancellationCutoffHours) {
    return {
      allowed: false,
      reason: `Appointments can be cancelled online up to ${BOOKING_RULES.cancellationCutoffHours} hours before. Call the clinic to cancel this one.`,
    };
  }
  return { allowed: true };
}
