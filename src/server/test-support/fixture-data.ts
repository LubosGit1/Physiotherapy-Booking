/**
 * Plain data, no imports: shared by the seed, integration tests and Cypress specs
 * (which import it by relative path). Fixed ids keep cached Cypress sessions valid
 * across database resets.
 */
export const FIXTURE_PASSWORD = "password123";

/** Monday 4 March 2030, 08:00 in Prague (UTC+1). The default frozen server time in E2E tests. */
export const FIXTURE_NOW = "2030-03-04T07:00:00.000Z";

export const FIXTURE_USERS = {
  anna: { id: "00000000-0000-4000-8000-000000000001", name: "Anna Brooks", email: "anna@example.com", role: "CLIENT" },
  ben: { id: "00000000-0000-4000-8000-000000000002", name: "Ben Walker", email: "ben@example.com", role: "CLIENT" },
  emma: { id: "00000000-0000-4000-8000-000000000003", name: "Emma Hart", email: "emma@motion.test", role: "THERAPIST" },
  mark: { id: "00000000-0000-4000-8000-000000000004", name: "Mark Cole", email: "mark@motion.test", role: "THERAPIST" },
  admin: { id: "00000000-0000-4000-8000-000000000005", name: "Clinic Admin", email: "admin@motion.test", role: "ADMIN" },
} as const;

export type FixtureUserKey = keyof typeof FIXTURE_USERS;

export const FIXTURE_THERAPISTS = {
  emma: "00000000-0000-4000-8000-000000000101",
  mark: "00000000-0000-4000-8000-000000000102",
} as const;

export const FIXTURE_SERVICES = {
  assessment: { id: "00000000-0000-4000-8000-000000000201", name: "Initial assessment", durationMin: 60, priceCents: 5500 },
  followUp: { id: "00000000-0000-4000-8000-000000000202", name: "Follow-up treatment", durationMin: 45, priceCents: 4500 },
  massage: { id: "00000000-0000-4000-8000-000000000203", name: "Sports massage", durationMin: 30, priceCents: 3000 },
} as const;
