import { NextResponse } from "next/server";

/**
 * Test-only endpoints exist only when E2E_TEST_MODE=1 and the caller knows the
 * secret. In any other environment they answer 404 as if they weren't there.
 */
export async function testOnly(request: Request, fn: () => Promise<unknown>) {
  const secret = process.env.E2E_TEST_SECRET;
  if (process.env.E2E_TEST_MODE !== "1" || !secret || request.headers.get("x-e2e-secret") !== secret) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    return NextResponse.json((await fn()) ?? { ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
