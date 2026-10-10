import { and, eq, gt, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, timeOff, workingHours } from "@/db/schema";
import { computeSlots, mergeSlots, type Interval } from "@/lib/availability";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { BOOKING_RULES, isBookableDate } from "@/lib/policies";
import { addDays, CLINIC_TIME_ZONE, isoWeekday, zonedTimeToUtc } from "@/lib/time";
import type { Slot } from "@/lib/types";
import { availabilitySchema, parseInput } from "@/lib/validation";
import { getActiveService, therapistsForService, type ServiceSummary, type TherapistSummary } from "./catalog";

type Executor = Pick<typeof db, "select">;

export function dayBounds(date: string) {
  return {
    start: new Date(zonedTimeToUtc(date, 0, CLINIC_TIME_ZONE)),
    end: new Date(zonedTimeToUtc(addDays(date, 1), 0, CLINIC_TIME_ZONE)),
  };
}

/** Appointments block a slot while confirmed, or while held and the hold hasn't run out. */
export const blocksSlot = (now: Date) =>
  or(
    eq(appointments.status, "CONFIRMED"),
    and(eq(appointments.status, "HELD"), gt(appointments.holdExpiresAt, now)),
  );

export async function slotsFor(
  executor: Executor,
  params: { service: ServiceSummary; therapists: TherapistSummary[]; date: string; now: Date },
): Promise<Slot[]> {
  const { service, date, now } = params;
  if (params.therapists.length === 0) return [];
  const ids = params.therapists.map((t) => t.id);
  const day = dayBounds(date);

  const [hours, booked, absences] = await Promise.all([
    executor
      .select()
      .from(workingHours)
      .where(and(inArray(workingHours.therapistId, ids), eq(workingHours.weekday, isoWeekday(date)))),
    executor
      .select({ therapistId: appointments.therapistId, start: appointments.startsAt, end: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          inArray(appointments.therapistId, ids),
          lt(appointments.startsAt, day.end),
          gt(appointments.endsAt, day.start),
          blocksSlot(now),
        ),
      ),
    executor
      .select({ therapistId: timeOff.therapistId, start: timeOff.startsAt, end: timeOff.endsAt })
      .from(timeOff)
      .where(and(inArray(timeOff.therapistId, ids), lt(timeOff.startsAt, day.end), gt(timeOff.endsAt, day.start))),
  ]);

  const toInterval = (row: { start: Date; end: Date }): Interval => ({ start: row.start.getTime(), end: row.end.getTime() });

  const perTherapist = params.therapists.map((therapist) => ({
    therapistId: therapist.id,
    slots: computeSlots({
      date,
      timeZone: CLINIC_TIME_ZONE,
      durationMinutes: service.durationMin,
      stepMinutes: BOOKING_RULES.slotStepMinutes,
      minLeadMinutes: BOOKING_RULES.minLeadMinutes,
      now: now.getTime(),
      windows: hours.filter((h) => h.therapistId === therapist.id),
      busy: [...booked, ...absences].filter((b) => b.therapistId === therapist.id).map(toInterval),
    }),
  }));

  const names = new Map(params.therapists.map((t) => [t.id, t.name]));
  return mergeSlots(perTherapist).map((slot) => ({
    startsAt: new Date(slot.startsAt).toISOString(),
    therapistId: slot.therapistId,
    therapistName: names.get(slot.therapistId)!,
  }));
}

export async function getAvailability(input: unknown, now: Date) {
  const query = parseInput(availabilitySchema, input);
  if (!isBookableDate(query.date, now)) {
    throw new ValidationError(`Pick a date within the next ${BOOKING_RULES.bookingWindowDays} days.`);
  }
  const service = await getActiveService(query.serviceId);
  const offering = await therapistsForService(service.id);
  const chosen = query.therapistId ? offering.filter((t) => t.id === query.therapistId) : offering;
  if (query.therapistId && chosen.length === 0) throw new NotFoundError("That therapist doesn't offer this service.");

  return { service, date: query.date, slots: await slotsFor(db, { service, therapists: chosen, date: query.date, now }) };
}
