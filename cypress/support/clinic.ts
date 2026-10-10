// Single source of truth for fixture data: the same module the server seeds from.
export {
  FIXTURE_NOW,
  FIXTURE_PASSWORD,
  FIXTURE_SERVICES as SERVICES,
  FIXTURE_THERAPISTS as THERAPISTS,
  FIXTURE_USERS as USERS,
  type FixtureUserKey,
} from "../../src/server/test-support/fixture-data";

export const TUESDAY = "2030-03-05";
export const WEDNESDAY = "2030-03-06";
export const SATURDAY = "2030-03-09";

/** "2030-03-05", "13:00" → ISO instant. March 2030 in Prague is UTC+1 (before the DST switch on the 31st). */
export function cetInstant(date: string, clock: string): string {
  const [h, m] = clock.split(":").map(Number);
  return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h - 1, m)).toISOString();
}
