import { handle } from "@/server/http";
import { listClientAppointments } from "@/server/services/bookings";

export function GET(request: Request) {
  return handle(request, ({ viewer, now }) => listClientAppointments(viewer, now));
}
