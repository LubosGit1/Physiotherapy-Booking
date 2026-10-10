import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { appointments, emailOutbox } from "@/db/schema";
import { ConflictError, ForbiddenError, GoneError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { cancelAppointment, confirmBooking, getHold, holdSlot, listClientAppointments } from "@/server/services/bookings";
import { at, insertConfirmed, key, MONDAY_8AM, plusMinutes, TUESDAY, setupClinic } from "./helpers";

const clinic = setupClinic();

const slotInput = (overrides: Partial<{ startsAt: string; idempotencyKey: string }> = {}) => ({
  serviceId: clinic.fx.services.massage,
  therapistId: clinic.fx.therapists.emma,
  startsAt: at(TUESDAY, "09:00").toISOString(),
  idempotencyKey: key(),
  ...overrides,
});

const statusOf = async (id: string) => (await db.query.appointments.findFirst({ where: eq(appointments.id, id) }))?.status;

describe("holdSlot", () => {
  it("creates a 10-minute hold that blocks the slot", async () => {
    const hold = await holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM);
    expect(hold.created).toBe(true);
    expect(hold.holdExpiresAt.toISOString()).toBe("2030-03-04T07:10:00.000Z");
    await expect(holdSlot(clinic.as("ben"), slotInput(), MONDAY_8AM)).rejects.toBeInstanceOf(ConflictError);
  });

  it("is idempotent: the same key returns the same hold", async () => {
    const input = slotInput();
    const first = await holdSlot(clinic.as("anna"), input, MONDAY_8AM);
    const again = await holdSlot(clinic.as("anna"), input, MONDAY_8AM);
    expect(again).toEqual({ ...first, created: false });
    expect(await db.$count(appointments)).toBe(1);
  });

  it("lets exactly one of two simultaneous requests win the slot", async () => {
    const results = await Promise.allSettled([
      holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM),
      holdSlot(clinic.as("ben"), slotInput(), MONDAY_8AM),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
  });

  it("frees the slot once the hold runs out", async () => {
    await holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM);
    const later = plusMinutes(MONDAY_8AM, 11);
    const ben = await holdSlot(clinic.as("ben"), slotInput(), later);
    expect(ben.created).toBe(true);
  });

  it("keeps one hold per client: a new pick releases the previous one", async () => {
    const first = await holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM);
    await holdSlot(clinic.as("anna"), slotInput({ startsAt: at(TUESDAY, "10:00").toISOString() }), MONDAY_8AM);
    expect(await statusOf(first.appointmentId)).toBe("EXPIRED");
  });

  it("refuses times that aren't real slots", async () => {
    const lunch = slotInput({ startsAt: at(TUESDAY, "12:00").toISOString() });
    await expect(holdSlot(clinic.as("anna"), lunch, MONDAY_8AM)).rejects.toBeInstanceOf(ConflictError);
    const offGrid = slotInput({ startsAt: at(TUESDAY, "09:07").toISOString() });
    await expect(holdSlot(clinic.as("anna"), offGrid, MONDAY_8AM)).rejects.toBeInstanceOf(ConflictError);
  });

  it("is only for signed-in clients", async () => {
    await expect(holdSlot(null, slotInput(), MONDAY_8AM)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(holdSlot(clinic.as("emma"), slotInput(), MONDAY_8AM)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("confirmBooking", () => {
  it("confirms the hold and queues a confirmation email in the same transaction", async () => {
    const hold = await holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM);
    await confirmBooking(clinic.as("anna"), hold.appointmentId, plusMinutes(MONDAY_8AM, 9));

    expect(await statusOf(hold.appointmentId)).toBe("CONFIRMED");
    const emails = await db.select().from(emailOutbox);
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      toEmail: "anna@example.com",
      subject: "Booked: Sports massage on Tuesday 5 March at 09:00",
      kind: "appointment-confirmed",
    });
  });

  it("refuses an expired hold and releases it", async () => {
    const hold = await holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM);
    await expect(confirmBooking(clinic.as("anna"), hold.appointmentId, plusMinutes(MONDAY_8AM, 10))).rejects.toBeInstanceOf(GoneError);
    expect(await statusOf(hold.appointmentId)).toBe("EXPIRED");
    expect(await db.$count(emailOutbox)).toBe(0);
  });

  it("can't confirm someone else's hold", async () => {
    const hold = await holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM);
    await expect(confirmBooking(clinic.as("ben"), hold.appointmentId, MONDAY_8AM)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getHold(clinic.as("ben"), hold.appointmentId, MONDAY_8AM)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is safe to call twice", async () => {
    const hold = await holdSlot(clinic.as("anna"), slotInput(), MONDAY_8AM);
    await confirmBooking(clinic.as("anna"), hold.appointmentId, MONDAY_8AM);
    await expect(confirmBooking(clinic.as("anna"), hold.appointmentId, MONDAY_8AM)).resolves.toMatchObject({ alreadyConfirmed: true });
    expect(await db.$count(emailOutbox)).toBe(1);
  });
});

describe("cancelAppointment", () => {
  const book = (startsAt: Date) =>
    insertConfirmed({
      clientId: clinic.fx.users.anna,
      therapistId: clinic.fx.therapists.emma,
      serviceId: clinic.fx.services.massage,
      startsAt,
    });

  it("lets clients cancel 24 hours ahead and emails them", async () => {
    const appointment = await book(at(TUESDAY, "09:00"));
    await cancelAppointment(clinic.as("anna"), appointment.id, MONDAY_8AM);
    expect(await statusOf(appointment.id)).toBe("CANCELLED");
    const [email] = await db.select().from(emailOutbox);
    expect(email.body).toContain("is cancelled");
  });

  it("refuses clients inside the cut-off, but not the clinic", async () => {
    const appointment = await book(at(TUESDAY, "08:00"));
    const late = plusMinutes(MONDAY_8AM, 1); // 23h59 before
    await expect(cancelAppointment(clinic.as("anna"), appointment.id, late)).rejects.toThrow(/24 hours/);

    await cancelAppointment(clinic.as("emma"), appointment.id, late);
    const [email] = await db.select().from(emailOutbox);
    expect(email.body).toContain("We had to cancel");
  });

  it("hides appointments from people who aren't involved", async () => {
    const appointment = await book(at(TUESDAY, "09:00"));
    await expect(cancelAppointment(clinic.as("ben"), appointment.id, MONDAY_8AM)).rejects.toBeInstanceOf(NotFoundError);
    await expect(cancelAppointment(clinic.as("mark"), appointment.id, MONDAY_8AM)).rejects.toBeInstanceOf(NotFoundError);
    await cancelAppointment(clinic.as("admin"), appointment.id, MONDAY_8AM);
    await expect(cancelAppointment(clinic.as("admin"), appointment.id, MONDAY_8AM)).rejects.toBeInstanceOf(ValidationError);
  });

  it("lists upcoming and past appointments with the cancel decision", async () => {
    await book(at(TUESDAY, "09:00"));
    await book(at("2030-03-04", "08:30"));
    const late = await book(at(TUESDAY, "08:00"));
    const { upcoming, past } = await listClientAppointments(clinic.as("anna"), plusMinutes(MONDAY_8AM, 60));

    expect(upcoming.map((a) => a.id)).toContain(late.id);
    expect(upcoming.find((a) => a.id === late.id)?.cancel.allowed).toBe(false);
    expect(past).toHaveLength(1);
  });
});
