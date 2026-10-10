import { after } from "next/server";
import { deliverPendingEmails } from "@/server/email/outbox";
import { handle } from "@/server/http";
import { cancelAppointment } from "@/server/services/bookings";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return handle(request, async ({ viewer, now }) => {
    await cancelAppointment(viewer, id, now);
    after(() => deliverPendingEmails());
    return { cancelled: true };
  });
}
