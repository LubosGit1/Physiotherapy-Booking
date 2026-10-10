import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { testOnly } from "@/server/test-support/guard";

/** GET /api/test/emails?to=… – the outbox acts as the test mailbox. */
export function GET(request: Request) {
  return testOnly(request, async () => {
    const to = new URL(request.url).searchParams.get("to");
    return db
      .select({ to: emailOutbox.toEmail, subject: emailOutbox.subject, body: emailOutbox.body, kind: emailOutbox.kind })
      .from(emailOutbox)
      .where(to ? eq(emailOutbox.toEmail, to.toLowerCase()) : undefined)
      .orderBy(asc(emailOutbox.createdAt));
  });
}
