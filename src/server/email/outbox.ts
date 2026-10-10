import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";

type Executor = Pick<typeof db, "insert">;
export type OutgoingEmail = { toEmail: string; subject: string; body: string; kind: string; appointmentId?: string };

/** Call with the transaction that changes the appointment, so the email exists only if the change commits. */
export async function enqueueEmail(executor: Executor, email: OutgoingEmail) {
  await executor.insert(emailOutbox).values(email);
}

export type EmailTransport = (email: OutgoingEmail) => Promise<void>;

const consoleTransport: EmailTransport = async (email) => {
  console.info(`[email] to=${email.toEmail} subject="${email.subject}"`);
};

/**
 * Delivers queued emails. SKIP LOCKED lets several workers run at once without
 * sending the same email twice. Swap the transport for Resend, SES, SMTP…
 */
export async function deliverPendingEmails(transport: EmailTransport = consoleTransport, batchSize = 20) {
  return db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(emailOutbox)
      .where(isNull(emailOutbox.sentAt))
      .orderBy(asc(emailOutbox.createdAt))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    for (const email of pending) {
      await transport({ ...email, appointmentId: email.appointmentId ?? undefined });
      await tx
        .update(emailOutbox)
        .set({ sentAt: sql`now()` })
        .where(and(eq(emailOutbox.id, email.id), isNull(emailOutbox.sentAt)));
    }
    return pending.length;
  });
}
