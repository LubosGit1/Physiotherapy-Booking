import { handle } from "@/server/http";
import { getAvailability } from "@/server/services/availability";

/** GET /api/availability?serviceId=…&date=YYYY-MM-DD[&therapistId=…] – public, rate limited per IP. */
export function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return handle(request, ({ now }) => getAvailability(params, now), {
    rateLimit: { name: "api:availability", rule: { limit: 120, windowMs: 60_000 } },
  });
}
