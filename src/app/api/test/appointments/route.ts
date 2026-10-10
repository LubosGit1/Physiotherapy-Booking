import { db } from "@/db";
import { appointments, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MINUTE } from "@/lib/time";
import { currentTime } from "@/server/clock";
import { testOnly } from "@/server/test-support/guard";

/**
 * POST { clientId, therapistId, serviceId, startsAt, status? } – creates an appointment
 * directly so a spec can start from a known state instead of clicking through booking.
 */
export function POST(request: Request) {
  return testOnly(request, async () => {
    const body = (await request.json()) as {
      clientId: string;
      therapistId: string;
      serviceId: string;
      startsAt: string;
      status?: "CONFIRMED" | "HELD";
    };
    const service = await db.query.services.findFirst({ where: eq(services.id, body.serviceId) });
    if (!service) throw new Error("Unknown service");
    const startsAt = new Date(body.startsAt);
    const now = await currentTime();
    const [row] = await db
      .insert(appointments)
      .values({
        clientId: body.clientId,
        therapistId: body.therapistId,
        serviceId: body.serviceId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + service.durationMin * MINUTE),
        status: body.status ?? "CONFIRMED",
        holdExpiresAt: body.status === "HELD" ? new Date(now.getTime() + 10 * MINUTE) : null,
        idempotencyKey: crypto.randomUUID(),
        confirmedAt: body.status === "HELD" ? null : now,
      })
      .returning({ id: appointments.id });
    return row;
  });
}
