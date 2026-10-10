import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { services, therapistServices, therapists, users } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Viewer } from "@/lib/types";
import { isUuid, parseInput, serviceSchema } from "@/lib/validation";

export type ServiceSummary = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  active: boolean;
};

const serviceColumns = {
  id: services.id,
  name: services.name,
  description: services.description,
  durationMin: services.durationMin,
  priceCents: services.priceCents,
  active: services.active,
};

export async function listActiveServices(): Promise<ServiceSummary[]> {
  return db.select(serviceColumns).from(services).where(eq(services.active, true)).orderBy(asc(services.durationMin), asc(services.name));
}

export async function getActiveService(serviceId: string): Promise<ServiceSummary> {
  const service = isUuid(serviceId)
    ? await db.query.services.findFirst({ where: and(eq(services.id, serviceId), eq(services.active, true)) })
    : undefined;
  if (!service) throw new NotFoundError("That service isn't available. Pick another one.");
  return service;
}

export type TherapistSummary = { id: string; name: string; title: string };

/** Therapists offering a service, ordered by name – this order also decides "any therapist". */
export async function therapistsForService(serviceId: string): Promise<TherapistSummary[]> {
  return db
    .select({ id: therapists.id, name: users.name, title: therapists.title })
    .from(therapistServices)
    .innerJoin(therapists, eq(therapists.id, therapistServices.therapistId))
    .innerJoin(users, eq(users.id, therapists.userId))
    .where(eq(therapistServices.serviceId, serviceId))
    .orderBy(asc(users.name));
}

export async function listTherapists(): Promise<TherapistSummary[]> {
  return db
    .select({ id: therapists.id, name: users.name, title: therapists.title })
    .from(therapists)
    .innerJoin(users, eq(users.id, therapists.userId))
    .orderBy(asc(users.name));
}

function requireAdmin(viewer: Viewer | null) {
  if (viewer?.role !== "ADMIN") throw new ForbiddenError("Only clinic admins can manage services.");
}

export async function listAllServices(viewer: Viewer | null) {
  requireAdmin(viewer);
  const rows = await db.select(serviceColumns).from(services).orderBy(asc(services.name));
  const links = await db
    .select({ serviceId: therapistServices.serviceId, name: users.name })
    .from(therapistServices)
    .innerJoin(therapists, eq(therapists.id, therapistServices.therapistId))
    .innerJoin(users, eq(users.id, therapists.userId))
    .orderBy(asc(users.name));
  return rows.map((row) => ({
    ...row,
    therapistNames: links.filter((l) => l.serviceId === row.id).map((l) => l.name),
  }));
}

export async function createService(viewer: Viewer | null, input: unknown) {
  requireAdmin(viewer);
  const data = parseInput(serviceSchema, input);

  const known = await db.select({ id: therapists.id }).from(therapists).where(inArray(therapists.id, data.therapistIds));
  if (known.length !== new Set(data.therapistIds).size) throw new NotFoundError("One of the therapists no longer exists.");

  return db.transaction(async (tx) => {
    const [service] = await tx
      .insert(services)
      .values({ name: data.name, description: data.description, durationMin: data.durationMin, priceCents: data.price })
      .returning(serviceColumns);
    await tx.insert(therapistServices).values(known.map((t) => ({ therapistId: t.id, serviceId: service.id })));
    return service;
  });
}

export async function setServiceActive(viewer: Viewer | null, serviceId: string, active: boolean) {
  requireAdmin(viewer);
  if (!isUuid(serviceId)) throw new NotFoundError("Service not found.");
  const [service] = await db.update(services).set({ active }).where(eq(services.id, serviceId)).returning(serviceColumns);
  if (!service) throw new NotFoundError("Service not found.");
  return service;
}
