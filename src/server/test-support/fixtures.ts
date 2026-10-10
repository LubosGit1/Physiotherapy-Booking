import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { services, therapistServices, therapists, users, workingHours } from "@/db/schema";
import { FIXTURE_PASSWORD, FIXTURE_SERVICES, FIXTURE_THERAPISTS, FIXTURE_USERS, type FixtureUserKey } from "./fixture-data";

export { FIXTURE_PASSWORD, FIXTURE_USERS, type FixtureUserKey } from "./fixture-data";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
let passwordHash: Promise<string> | undefined;

/** Wipes every table and loads the fixture clinic. Used by the dev seed, integration tests and Cypress. */
export async function resetDatabase() {
  await db.execute(sql`
    TRUNCATE users, therapists, services, therapist_services, working_hours, time_off,
             appointments, email_outbox, rate_limits, test_clock RESTART IDENTITY CASCADE
  `);
  return seedFixtures();
}

export async function seedFixtures() {
  passwordHash ??= hash(FIXTURE_PASSWORD, 10);
  const password = await passwordHash;
  const { emma, mark } = FIXTURE_THERAPISTS;
  const { assessment, followUp, massage } = FIXTURE_SERVICES;

  await db.insert(users).values(Object.values(FIXTURE_USERS).map((u) => ({ ...u, passwordHash: password })));
  await db.insert(therapists).values([
    { id: emma, userId: FIXTURE_USERS.emma.id, title: "Musculoskeletal physiotherapist", bio: "Back and neck pain, posture, rehabilitation after surgery." },
    { id: mark, userId: FIXTURE_USERS.mark.id, title: "Sports physiotherapist", bio: "Running injuries, knees and shoulders, return to sport." },
  ]);
  await db.insert(services).values([
    { ...assessment, description: "First visit: history, movement assessment and a treatment plan." },
    { ...followUp, description: "Hands-on treatment and exercises, for returning clients." },
    { ...massage, description: "Deep tissue massage focused on recovery." },
  ]);
  await db.insert(therapistServices).values([
    { therapistId: emma, serviceId: assessment.id },
    { therapistId: emma, serviceId: followUp.id },
    { therapistId: emma, serviceId: massage.id },
    { therapistId: mark, serviceId: followUp.id },
    { therapistId: mark, serviceId: massage.id },
  ]);
  // Emma: Mon–Fri 08:00–12:00 and 12:30–16:00 (lunch break). Mark: Mon–Thu 12:00–20:00.
  await db.insert(workingHours).values([
    ...[1, 2, 3, 4, 5].flatMap((weekday) => [
      { therapistId: emma, weekday, startMinute: h(8), endMinute: h(12) },
      { therapistId: emma, weekday, startMinute: h(12, 30), endMinute: h(16) },
    ]),
    ...[1, 2, 3, 4].map((weekday) => ({ therapistId: mark, weekday, startMinute: h(12), endMinute: h(20) })),
  ]);

  return {
    users: Object.fromEntries(Object.entries(FIXTURE_USERS).map(([k, u]) => [k, u.id])) as Record<FixtureUserKey, string>,
    therapists: { ...FIXTURE_THERAPISTS },
    services: { assessment: assessment.id, followUp: followUp.id, massage: massage.id },
  };
}

export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
