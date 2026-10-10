import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { appointments, services, therapists, timeOff, users } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { addDays, CLINIC_TIME_ZONE, DAY, parseLocalDateTime, zonedTimeToUtc } from "@/lib/time";
import type { Viewer } from "@/lib/types";
import { isUuid, parseInput, timeOffSchema } from "@/lib/validation";
import { blocksSlot } from "./availability";

const client = alias(users, "client");

async function requireTherapist(viewer: Viewer | null) {
  if (viewer?.role !== "THERAPIST") throw new ForbiddenError("Only therapists have a schedule.");
  const therapist = await db.query.therapists.findFirst({ where: eq(therapists.userId, viewer.id) });
  if (!therapist) throw new NotFoundError("Your therapist profile is missing. Contact the clinic admin.");
  return therapist;
}

export async function getTherapistWeek(viewer: Viewer | null, weekStart: string) {
  const therapist = await requireTherapist(viewer);
  const from = new Date(zonedTimeToUtc(weekStart, 0, CLINIC_TIME_ZONE));
  const to = new Date(zonedTimeToUtc(addDays(weekStart, 7), 0, CLINIC_TIME_ZONE));

  const [sessions, absences] = await Promise.all([
    db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        serviceName: services.name,
        clientName: client.name,
      })
      .from(appointments)
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(client, eq(client.id, appointments.clientId))
      .where(
        and(
          eq(appointments.therapistId, therapist.id),
          eq(appointments.status, "CONFIRMED"),
          gte(appointments.startsAt, from),
          lt(appointments.startsAt, to),
        ),
      )
      .orderBy(asc(appointments.startsAt)),
    db
      .select()
      .from(timeOff)
      .where(and(eq(timeOff.therapistId, therapist.id), lt(timeOff.startsAt, to), gt(timeOff.endsAt, from)))
      .orderBy(asc(timeOff.startsAt)),
  ]);
  return { sessions, absences };
}

/** Blocks time in the therapist's calendar; refuses if it would clash with booked sessions. */
export async function addTimeOff(viewer: Viewer | null, input: unknown, now: Date) {
  const therapist = await requireTherapist(viewer);
  const data = parseInput(timeOffSchema, input);
  const startsAt = parseLocalDateTime(data.startsAt, CLINIC_TIME_ZONE);
  const endsAt = parseLocalDateTime(data.endsAt, CLINIC_TIME_ZONE);
  if (startsAt === null || endsAt === null) throw new ValidationError("Enter a valid start and end time.");
  if (endsAt <= startsAt) throw new ValidationError("The end has to be after the start.");
  if (endsAt <= now.getTime()) throw new ValidationError("Time off has to end in the future.");
  if (endsAt - startsAt > 31 * DAY) throw new ValidationError("Time off can be at most 31 days at once.");

  const range = { start: new Date(startsAt), end: new Date(endsAt) };
  const clashes = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.therapistId, therapist.id),
        lt(appointments.startsAt, range.end),
        gt(appointments.endsAt, range.start),
        blocksSlot(now),
      ),
    );
  if (clashes.length > 0) {
    const count = clashes.length === 1 ? "1 booked session" : `${clashes.length} booked sessions`;
    throw new ConflictError(`You have ${count} during that time. Cancel or move them first.`);
  }

  const [row] = await db
    .insert(timeOff)
    .values({ therapistId: therapist.id, startsAt: range.start, endsAt: range.end, reason: data.reason })
    .returning();
  return row;
}

export async function deleteTimeOff(viewer: Viewer | null, id: string) {
  const therapist = await requireTherapist(viewer);
  if (!isUuid(id)) throw new NotFoundError("Time off not found.");
  const deleted = await db
    .delete(timeOff)
    .where(and(eq(timeOff.id, id), eq(timeOff.therapistId, therapist.id)))
    .returning({ id: timeOff.id });
  if (deleted.length === 0) throw new NotFoundError("Time off not found.");
}
