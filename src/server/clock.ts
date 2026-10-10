import { db } from "@/db";

/**
 * The server's idea of "now". End-to-end tests freeze and move it through
 * /api/test/clock; everywhere else it's the real time. Services never call
 * new Date() themselves – they receive `now`, which keeps them deterministic.
 */
export async function currentTime(): Promise<Date> {
  if (process.env.E2E_TEST_MODE === "1") {
    const frozen = await db.query.testClock.findFirst();
    if (frozen) return frozen.now;
  }
  return new Date();
}
