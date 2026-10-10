import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimitRule = { limit: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export const LOGIN_LIMIT: RateLimitRule = { limit: 5, windowMs: 15 * 60_000 };

/**
 * Fixed-window counter in a single atomic upsert, so it works with several app
 * instances and concurrent requests (no read-then-write race).
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule, now: Date): Promise<RateLimitResult> {
  const windowOpensAfter = new Date(now.getTime() - rule.windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} <= ${windowOpensAfter} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} <= ${windowOpensAfter} THEN ${now} ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning();
  return toResult(row.count, row.windowStart, rule, now);
}

export async function peekRateLimit(key: string, rule: RateLimitRule, now: Date): Promise<RateLimitResult> {
  const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key) });
  if (!row || row.windowStart.getTime() <= now.getTime() - rule.windowMs) {
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
  // Peeking asks "may one more attempt be made?", so the limit itself already blocks.
  return toResult(row.count + 1, row.windowStart, rule, now);
}

export async function resetRateLimit(key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

function toResult(count: number, windowStart: Date, rule: RateLimitRule, now: Date): RateLimitResult {
  const allowed = count <= rule.limit;
  const retryAfterMs = windowStart.getTime() + rule.windowMs - now.getTime();
  return {
    allowed,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

export const loginKey = (email: string) => `login:${email.trim().toLowerCase()}`;
