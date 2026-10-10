import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { deliverPendingEmails } from "@/server/email/outbox";
import { consumeRateLimit, LOGIN_LIMIT, peekRateLimit } from "@/server/rate-limit";
import { getAvailability } from "@/server/services/availability";
import { createService, listActiveServices } from "@/server/services/catalog";
import { addTimeOff, deleteTimeOff } from "@/server/services/schedule";
import { at, clock, insertConfirmed, MONDAY_8AM, plusMinutes, TUESDAY, setupClinic } from "./helpers";

const clinic = setupClinic();

describe("time off", () => {
  it("removes the hours from booking", async () => {
    await addTimeOff(clinic.as("emma"), { startsAt: `${TUESDAY}T08:00`, endsAt: `${TUESDAY}T12:00`, reason: "Course" }, MONDAY_8AM);
    const { slots } = await getAvailability(
      { serviceId: clinic.fx.services.massage, therapistId: clinic.fx.therapists.emma, date: TUESDAY },
      MONDAY_8AM,
    );
    expect(clock(slots[0].startsAt)).toBe("12:30");
  });

  it("refuses to overlap booked sessions and explains how many", async () => {
    await insertConfirmed({ clientId: clinic.fx.users.anna, therapistId: clinic.fx.therapists.emma, serviceId: clinic.fx.services.massage, startsAt: at(TUESDAY, "09:00") });
    await expect(
      addTimeOff(clinic.as("emma"), { startsAt: `${TUESDAY}T08:30`, endsAt: `${TUESDAY}T10:00` }, MONDAY_8AM),
    ).rejects.toThrow(new ConflictError("You have 1 booked session during that time. Cancel or move them first."));
  });

  it("validates the range and ownership", async () => {
    const emma = clinic.as("emma");
    await expect(addTimeOff(emma, { startsAt: `${TUESDAY}T12:00`, endsAt: `${TUESDAY}T11:00` }, MONDAY_8AM)).rejects.toBeInstanceOf(ValidationError);
    await expect(addTimeOff(clinic.as("anna"), { startsAt: `${TUESDAY}T08:00`, endsAt: `${TUESDAY}T09:00` }, MONDAY_8AM)).rejects.toBeInstanceOf(ForbiddenError);

    const mine = await addTimeOff(emma, { startsAt: `${TUESDAY}T08:00`, endsAt: `${TUESDAY}T09:00` }, MONDAY_8AM);
    await expect(deleteTimeOff(clinic.as("mark"), mine.id)).rejects.toBeInstanceOf(NotFoundError);
    await deleteTimeOff(emma, mine.id);
  });
});

describe("services", () => {
  it("admins add services that become bookable with the chosen therapists", async () => {
    const service = await createService(clinic.as("admin"), {
      name: "Dry needling",
      durationMin: "30",
      price: "40",
      therapistIds: [clinic.fx.therapists.mark],
    });
    expect((await listActiveServices()).map((s) => s.name)).toContain("Dry needling");
    const { slots } = await getAvailability({ serviceId: service.id, date: TUESDAY }, MONDAY_8AM);
    expect(new Set(slots.map((s) => s.therapistName))).toEqual(new Set(["Mark Cole"]));
  });

  it("is admin-only", async () => {
    await expect(createService(clinic.as("emma"), {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("rate limiting", () => {
  it("allows five attempts per window, then blocks until the window passes", async () => {
    for (let i = 0; i < LOGIN_LIMIT.limit; i++) {
      expect((await consumeRateLimit("login:x", LOGIN_LIMIT, MONDAY_8AM)).allowed).toBe(true);
    }
    const blocked = await consumeRateLimit("login:x", LOGIN_LIMIT, plusMinutes(MONDAY_8AM, 1));
    expect(blocked).toMatchObject({ allowed: false, retryAfterSeconds: 14 * 60 });
    expect((await peekRateLimit("login:x", LOGIN_LIMIT, plusMinutes(MONDAY_8AM, 1))).allowed).toBe(false);

    const later = plusMinutes(MONDAY_8AM, 15);
    expect((await peekRateLimit("login:x", LOGIN_LIMIT, later)).allowed).toBe(true);
    expect((await consumeRateLimit("login:x", LOGIN_LIMIT, later)).allowed).toBe(true);
  });

  it("counts correctly under concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => consumeRateLimit("login:y", LOGIN_LIMIT, MONDAY_8AM)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});

it("delivers each queued email exactly once", async () => {
  await db.insert(emailOutbox).values([
    { toEmail: "a@example.com", subject: "One", body: "…", kind: "test" },
    { toEmail: "b@example.com", subject: "Two", body: "…", kind: "test" },
  ]);
  const sent: string[] = [];
  const transport = async (email: { subject: string }) => void sent.push(email.subject);

  await Promise.all([deliverPendingEmails(transport), deliverPendingEmails(transport)]);
  await deliverPendingEmails(transport);
  expect(sent.sort()).toEqual(["One", "Two"]);
});
