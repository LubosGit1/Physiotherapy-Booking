import { NextResponse } from "next/server";
import { RateLimitError, toHttpError } from "@/lib/errors";
import type { Viewer } from "@/lib/types";
import { currentTime } from "./clock";
import { consumeRateLimit, type RateLimitRule } from "./rate-limit";
import { getViewer } from "./viewer";

type Context = { viewer: Viewer | null; now: Date; request: Request };

/** Route handler wrapper: resolves viewer and time, maps domain errors to JSON + status codes. */
export async function handle<T>(
  request: Request,
  fn: (ctx: Context) => Promise<T>,
  options: { status?: number | ((data: T) => number); rateLimit?: { name: string; rule: RateLimitRule } } = {},
) {
  try {
    const now = await currentTime();
    if (options.rateLimit) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
      const result = await consumeRateLimit(`${options.rateLimit.name}:${ip}`, options.rateLimit.rule, now);
      if (!result.allowed) throw new RateLimitError("Too many requests. Slow down and try again shortly.", result.retryAfterSeconds);
    }
    const data = await fn({ viewer: await getViewer(), now, request });
    const status = typeof options.status === "function" ? options.status(data) : (options.status ?? 200);
    return NextResponse.json(data, { status });
  } catch (error) {
    const { status, message } = toHttpError(error);
    if (status === 500) console.error(error);
    const headers = error instanceof RateLimitError ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
    return NextResponse.json({ error: message }, { status, headers });
  }
}

export const readJson = (request: Request) => request.json().catch(() => null);
