import { resetDatabase } from "@/server/test-support/fixtures";
import { testOnly } from "@/server/test-support/guard";

/** POST /api/test/reset – wipes the database and loads the fixture clinic. Returns fixture ids. */
export function POST(request: Request) {
  return testOnly(request, () => resetDatabase());
}
