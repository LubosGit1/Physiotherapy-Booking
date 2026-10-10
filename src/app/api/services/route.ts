import { handle } from "@/server/http";
import { listActiveServices } from "@/server/services/catalog";

export function GET(request: Request) {
  return handle(request, () => listActiveServices());
}
