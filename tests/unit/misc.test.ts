import { describe, expect, it } from "vitest";
import { formatRemaining } from "@/components/booking/HoldCountdown";
import { bookHref } from "@/lib/booking-url";
import { ConflictError, pgErrorCode, RateLimitError, toHttpError } from "@/lib/errors";
import { formatPrice, parsePrice } from "@/lib/money";
import { holdSchema, parseInput, serviceSchema } from "@/lib/validation";
import { cancellationEmail, confirmationEmail } from "@/server/email/templates";

const uuid = "4b0d2c1e-8f5a-4a37-9d2e-6c1b7a9e0f11";

describe("money", () => {
  it("formats whole and partial euros", () => {
    expect(formatPrice(5500)).toBe("€55");
    expect(formatPrice(4550)).toBe("€45.50");
  });

  it.each([
    ["45", 4500],
    ["45.5", 4550],
    ["45,50", 4550],
    [" 30 ", 3000],
  ])("parses %s", (input, cents) => {
    expect(parsePrice(input)).toBe(cents);
  });

  it.each(["", "-5", "4.555", "abc", "12345"])("rejects %s", (input) => {
    expect(parsePrice(input)).toBeNull();
  });
});

describe("serviceSchema", () => {
  const valid = { name: "Dry needling", durationMin: "30", price: "40", therapistIds: [uuid] };

  it("coerces form values", () => {
    expect(serviceSchema.parse(valid)).toEqual({ name: "Dry needling", description: null, durationMin: 30, price: 4000, therapistIds: [uuid] });
  });

  it("explains invalid values", () => {
    expect(() => parseInput(serviceSchema, { ...valid, durationMin: "50" })).toThrow("Pick one of the listed durations.");
    expect(() => parseInput(serviceSchema, { ...valid, price: "free" })).toThrow(/price in euros/);
    expect(() => parseInput(serviceSchema, { ...valid, therapistIds: [] })).toThrow(/at least one therapist/);
  });
});

it("holdSchema requires an ISO time with offset", () => {
  const base = { serviceId: uuid, therapistId: uuid, idempotencyKey: "abcdefgh12" };
  expect(holdSchema.safeParse({ ...base, startsAt: "2030-03-05T09:00:00.000Z" }).success).toBe(true);
  expect(holdSchema.safeParse({ ...base, startsAt: "tomorrow at nine" }).success).toBe(false);
});

describe("errors", () => {
  it("maps domain errors and hides unexpected ones", () => {
    expect(toHttpError(new ConflictError("Taken"))).toEqual({ status: 409, message: "Taken" });
    expect(toHttpError(new RateLimitError("Slow down", 30)).status).toBe(429);
    expect(toHttpError(new Error("password=hunter2")).message).not.toContain("hunter2");
  });

  it("finds the Postgres code inside wrapped errors", () => {
    expect(pgErrorCode({ cause: { code: "23P01" } })).toBe("23P01");
    expect(pgErrorCode(new Error("plain"))).toBeUndefined();
  });
});

describe("emails", () => {
  const data = {
    clientName: "Anna Brooks",
    serviceName: "Sports massage",
    therapistName: "Mark Cole",
    startsAt: new Date("2030-03-05T13:00:00Z"),
    priceCents: 3000,
  };

  it("confirmation shows local time and price", () => {
    const email = confirmationEmail(data);
    expect(email.subject).toBe("Booked: Sports massage on Tuesday 5 March at 14:00");
    expect(email.body).toContain("with Mark Cole");
    expect(email.body).toContain("€30");
  });

  it("cancellation wording depends on who cancelled", () => {
    expect(cancellationEmail({ ...data, cancelledByClinic: true }).body).toContain("We had to cancel");
    expect(cancellationEmail({ ...data, cancelledByClinic: false }).body).toContain("is cancelled");
  });
});

it("bookHref keeps only the given parameters", () => {
  expect(bookHref({})).toBe("/book");
  expect(bookHref({ service: "s", date: "2030-03-04" })).toBe("/book?service=s&date=2030-03-04");
});

it("formatRemaining rounds up to whole seconds", () => {
  expect(formatRemaining(600_000)).toBe("10:00");
  expect(formatRemaining(59_001)).toBe("1:00");
  expect(formatRemaining(-5)).toBe("0:00");
});
