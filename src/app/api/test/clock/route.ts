import { db } from "@/db";
import { testClock } from "@/db/schema";
import { MINUTE } from "@/lib/time";
import { currentTime } from "@/server/clock";
import { testOnly } from "@/server/test-support/guard";

/** POST { now: ISO } freezes server time; POST { advanceMinutes } moves it forward. */
export function POST(request: Request) {
  return testOnly(request, async () => {
    const body = (await request.json()) as { now?: string; advanceMinutes?: number };
    const base = body.now ? new Date(body.now) : await currentTime();
    const now = new Date(base.getTime() + (body.advanceMinutes ?? 0) * MINUTE);
    if (Number.isNaN(now.getTime())) throw new Error("Invalid time");
    await db.insert(testClock).values({ id: 1, now }).onConflictDoUpdate({ target: testClock.id, set: { now } });
    return { now: now.toISOString() };
  });
}

export function DELETE(request: Request) {
  return testOnly(request, async () => {
    await db.delete(testClock);
  });
}
