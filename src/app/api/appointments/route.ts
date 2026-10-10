import { handle, readJson } from "@/server/http";
import { holdSlot } from "@/server/services/bookings";

/**
 * POST /api/appointments – { serviceId, therapistId, startsAt, idempotencyKey }
 * 201 when a new hold is created, 200 when the idempotency key was already used.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  return handle(request, ({ viewer, now }) => holdSlot(viewer, body, now), {
    status: (result) => (result.created ? 201 : 200),
  });
}

export const dynamic = "force-dynamic";
