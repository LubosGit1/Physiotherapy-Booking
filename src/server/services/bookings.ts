import { and, asc, eq, gte, lt, lte, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { appointments, services, therapists, users } from "@/db/schema";
import { ConflictError, ForbiddenError, GoneError, NotFoundError, pgErrorCode, UnauthorizedError, ValidationError } from "@/lib/errors";
import { clientCancellation, holdExpiry, isBookableDate, type CancelDecision } from "@/lib/policies";
import { CLINIC_TIME_ZONE, localDate, MINUTE } from "@/lib/time";
import type { Viewer } from "@/lib/types";
import { holdSchema, isUuid, parseInput } from "@/lib/validation";
import { enqueueEmail } from "@/server/email/outbox";
import { cancellationEmail, confirmationEmail } from "@/server/email/templates";
import { dayBounds, slotsFor } from "./availability";
import { getActiveService, therapistsForService } from "./catalog";

export const SLOT_TAKEN = "Someone has just booked that time. Pick another slot.";

function requireClient(viewer: Viewer | null): Viewer {
  if (!viewer) throw new UnauthorizedError("Sign in to book an appointment.");
  if (viewer.role !== "CLIENT") throw new ForbiddenError("Appointments are booked from a client account.");
  return viewer;
}

async function findByIdempotencyKey(clientId: string, key: string) {
  return db.query.appointments.findFirst({
    where: and(eq(appointments.clientId, clientId), eq(appointments.idempotencyKey, key)),
  });
}

export type HoldResult = { appointmentId: string; holdExpiresAt: Date; created: boolean };

/**
 * Reserves a slot for a few minutes. Safe to retry: the same idempotency key always
 * returns the same hold. Races between clients are settled by the exclusion
 * constraint, not by the availability check above it.
 */
export async function holdSlot(viewerOrNull: Viewer | null, input: unknown, now: Date): Promise<HoldResult> {
  const viewer = requireClient(viewerOrNull);
  const data = parseInput(holdSchema, input);

  const existing = await findByIdempotencyKey(viewer.id, data.idempotencyKey);
  if (existing) return { appointmentId: existing.id, holdExpiresAt: existing.holdExpiresAt ?? now, created: false };

  const service = await getActiveService(data.serviceId);
  const therapist = (await therapistsForService(service.id)).find((t) => t.id === data.therapistId);
  if (!therapist) throw new NotFoundError("That therapist doesn't offer this service.");

  const date = localDate(data.startsAt.getTime(), CLINIC_TIME_ZONE);
  if (!isBookableDate(date, now)) throw new ValidationError("That date can't be booked online.");
  const free = await slotsFor(db, { service, therapists: [therapist], date, now });
  if (!free.some((slot) => slot.startsAt === data.startsAt.toISOString())) throw new ConflictError(SLOT_TAKEN);

  const expiresAt = holdExpiry(now);
  try {
    return await db.transaction(async (tx) => {
      // Holds that ran out still count for the constraint until they're marked expired.
      await tx
        .update(appointments)
        .set({ status: "EXPIRED" })
        .where(and(eq(appointments.therapistId, therapist.id), eq(appointments.status, "HELD"), lte(appointments.holdExpiresAt, now)));
      // One hold per client: picking a new time releases the previous one.
      await tx
        .update(appointments)
        .set({ status: "EXPIRED" })
        .where(and(eq(appointments.clientId, viewer.id), eq(appointments.status, "HELD")));

      const [row] = await tx
        .insert(appointments)
        .values({
          clientId: viewer.id,
          therapistId: therapist.id,
          serviceId: service.id,
          startsAt: data.startsAt,
          endsAt: new Date(data.startsAt.getTime() + service.durationMin * MINUTE),
          status: "HELD",
          holdExpiresAt: expiresAt,
          idempotencyKey: data.idempotencyKey,
        })
        .returning({ id: appointments.id });
      return { appointmentId: row.id, holdExpiresAt: expiresAt, created: true };
    });
  } catch (error) {
    const code = pgErrorCode(error);
    if (code === "23505" || code === "23P01") {
      const winner = await findByIdempotencyKey(viewer.id, data.idempotencyKey);
      if (winner) return { appointmentId: winner.id, holdExpiresAt: winner.holdExpiresAt ?? expiresAt, created: false };
      if (code === "23P01") throw new ConflictError(SLOT_TAKEN);
    }
    throw error;
  }
}

async function loadAppointment(id: string) {
  if (!isUuid(id)) return undefined;
  const row = await db
    .select({
      appointment: appointments,
      serviceName: services.name,
      priceCents: services.priceCents,
      durationMin: services.durationMin,
      therapistName: users.name,
      therapistUserId: therapists.userId,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(therapists, eq(therapists.id, appointments.therapistId))
    .innerJoin(users, eq(users.id, therapists.userId))
    .where(eq(appointments.id, id));
  if (!row[0]) return undefined;
  const client = await db.query.users.findFirst({ where: eq(users.id, row[0].appointment.clientId) });
  return { ...row[0], client: client! };
}

export type HoldView = {
  id: string;
  state: "active" | "expired" | "confirmed" | "cancelled";
  serviceName: string;
  therapistName: string;
  priceCents: number;
  durationMin: number;
  startsAt: Date;
  holdExpiresAt: Date | null;
};

export async function getHold(viewerOrNull: Viewer | null, id: string, now: Date): Promise<HoldView> {
  const viewer = requireClient(viewerOrNull);
  const found = await loadAppointment(id);
  if (!found || found.appointment.clientId !== viewer.id) throw new NotFoundError("We couldn't find that booking.");
  const a = found.appointment;
  const state =
    a.status === "CONFIRMED"
      ? "confirmed"
      : a.status === "CANCELLED"
        ? "cancelled"
        : a.status === "HELD" && a.holdExpiresAt && a.holdExpiresAt > now
          ? "active"
          : "expired";
  return {
    id: a.id,
    state,
    serviceName: found.serviceName,
    therapistName: found.therapistName,
    priceCents: found.priceCents,
    durationMin: found.durationMin,
    startsAt: a.startsAt,
    holdExpiresAt: a.holdExpiresAt,
  };
}

export async function confirmBooking(viewerOrNull: Viewer | null, id: string, now: Date) {
  const viewer = requireClient(viewerOrNull);
  const found = await loadAppointment(id);
  if (!found || found.appointment.clientId !== viewer.id) throw new NotFoundError("We couldn't find that booking.");
  const a = found.appointment;

  if (a.status === "CONFIRMED") return { appointmentId: a.id, alreadyConfirmed: true };
  if (a.status !== "HELD" || !a.holdExpiresAt || a.holdExpiresAt <= now) {
    if (a.status === "HELD") await db.update(appointments).set({ status: "EXPIRED" }).where(eq(appointments.id, a.id));
    throw new GoneError("Your 10-minute hold ran out and the time was released. Pick a time again.");
  }

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(appointments)
      .set({ status: "CONFIRMED", confirmedAt: now, holdExpiresAt: null })
      .where(and(eq(appointments.id, a.id), eq(appointments.status, "HELD")))
      .returning({ id: appointments.id });
    if (!updated) throw new GoneError("This hold is no longer active. Pick a time again.");

    const email = confirmationEmail({
      clientName: found.client.name,
      serviceName: found.serviceName,
      therapistName: found.therapistName,
      startsAt: a.startsAt,
      priceCents: found.priceCents,
    });
    await enqueueEmail(tx, { ...email, toEmail: found.client.email, appointmentId: a.id });
  });
  return { appointmentId: a.id, alreadyConfirmed: false };
}

export async function releaseHold(viewerOrNull: Viewer | null, id: string) {
  const viewer = requireClient(viewerOrNull);
  if (!isUuid(id)) return;
  await db
    .update(appointments)
    .set({ status: "EXPIRED" })
    .where(and(eq(appointments.id, id), eq(appointments.clientId, viewer.id), eq(appointments.status, "HELD")));
}

/** Clients follow the 24-hour rule; therapists can cancel their own sessions and admins any. */
export async function cancelAppointment(viewer: Viewer | null, id: string, now: Date) {
  if (!viewer) throw new UnauthorizedError();
  const found = await loadAppointment(id);
  if (!found) throw new NotFoundError("Appointment not found.");
  const a = found.appointment;

  const isOwnClient = viewer.role === "CLIENT" && a.clientId === viewer.id;
  const isOwnTherapist = viewer.role === "THERAPIST" && found.therapistUserId === viewer.id;
  if (!isOwnClient && !isOwnTherapist && viewer.role !== "ADMIN") throw new NotFoundError("Appointment not found.");
  if (a.status !== "CONFIRMED") throw new ValidationError("Only confirmed appointments can be cancelled.");

  if (isOwnClient) {
    const decision = clientCancellation(a.startsAt, now);
    if (!decision.allowed) throw new ValidationError(decision.reason);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ status: "CANCELLED", cancelledAt: now, cancelledById: viewer.id })
      .where(eq(appointments.id, a.id));
    const email = cancellationEmail({
      clientName: found.client.name,
      serviceName: found.serviceName,
      therapistName: found.therapistName,
      startsAt: a.startsAt,
      priceCents: found.priceCents,
      cancelledByClinic: !isOwnClient,
    });
    await enqueueEmail(tx, { ...email, toEmail: found.client.email, appointmentId: a.id });
  });
}

export type ClientAppointment = {
  id: string;
  serviceName: string;
  therapistName: string;
  startsAt: Date;
  endsAt: Date;
  status: "CONFIRMED" | "CANCELLED";
  cancel: CancelDecision;
};

export async function listClientAppointments(viewerOrNull: Viewer | null, now: Date) {
  const viewer = requireClient(viewerOrNull);
  const rows = await db
    .select({
      id: appointments.id,
      serviceName: services.name,
      therapistName: users.name,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(therapists, eq(therapists.id, appointments.therapistId))
    .innerJoin(users, eq(users.id, therapists.userId))
    .where(and(eq(appointments.clientId, viewer.id), ne(appointments.status, "HELD"), ne(appointments.status, "EXPIRED")))
    .orderBy(asc(appointments.startsAt));

  const list = rows.map((row) => ({
    ...row,
    status: row.status as ClientAppointment["status"],
    cancel: row.status === "CONFIRMED" ? clientCancellation(row.startsAt, now) : ({ allowed: false, reason: "Cancelled" } as const),
  }));
  return {
    upcoming: list.filter((a) => a.status === "CONFIRMED" && a.startsAt > now),
    past: list.filter((a) => a.status === "CANCELLED" || a.startsAt <= now).reverse(),
  };
}

const clientUser = alias(users, "client_user");

export async function listDayAppointments(viewer: Viewer | null, date: string) {
  if (viewer?.role !== "ADMIN") throw new ForbiddenError();
  const day = dayBounds(date);
  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      serviceName: services.name,
      therapistName: users.name,
      clientName: clientUser.name,
      clientEmail: clientUser.email,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(therapists, eq(therapists.id, appointments.therapistId))
    .innerJoin(users, eq(users.id, therapists.userId))
    .innerJoin(clientUser, eq(clientUser.id, appointments.clientId))
    .where(and(eq(appointments.status, "CONFIRMED"), gte(appointments.startsAt, day.start), lt(appointments.startsAt, day.end)))
    .orderBy(asc(appointments.startsAt), asc(users.name));
}
