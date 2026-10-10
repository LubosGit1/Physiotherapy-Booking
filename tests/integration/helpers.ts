import { beforeEach } from "vitest";
import { db } from "@/db";
import { appointments, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CLINIC_TIME_ZONE, MINUTE, zonedTimeToUtc } from "@/lib/time";
import type { Viewer } from "@/lib/types";
import { FIXTURE_USERS, resetDatabase, type FixtureUserKey, type Fixtures } from "@/server/test-support/fixtures";

/** Monday 4 March 2030, 08:00 in Prague. Every test starts from here. */
export const MONDAY_8AM = new Date("2030-03-04T07:00:00Z");
export const TUESDAY = "2030-03-05";

export const at = (date: string, clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return new Date(zonedTimeToUtc(date, h * 60 + m, CLINIC_TIME_ZONE));
};
export const plusMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * MINUTE);

/** Fresh fixture clinic before every test in the file. */
export function setupClinic() {
  const ctx = {} as { fx: Fixtures; as: (key: FixtureUserKey) => Viewer };
  beforeEach(async () => {
    ctx.fx = await resetDatabase();
    ctx.as = (key) => ({ id: ctx.fx.users[key], role: FIXTURE_USERS[key].role, name: FIXTURE_USERS[key].name, email: FIXTURE_USERS[key].email });
  });
  return ctx;
}

let keyCounter = 0;
export const key = () => `test-key-${++keyCounter}-${Date.now()}`;

export async function insertConfirmed(params: { clientId: string; therapistId: string; serviceId: string; startsAt: Date }) {
  const service = await db.query.services.findFirst({ where: eq(services.id, params.serviceId) });
  const [row] = await db
    .insert(appointments)
    .values({
      ...params,
      endsAt: plusMinutes(params.startsAt, service!.durationMin),
      status: "CONFIRMED",
      idempotencyKey: key(),
      confirmedAt: MONDAY_8AM,
    })
    .returning();
  return row;
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: CLINIC_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
