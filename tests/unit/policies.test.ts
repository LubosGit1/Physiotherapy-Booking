import { describe, expect, it } from "vitest";
import { BOOKING_RULES, bookableDates, clientCancellation, holdExpiry, isBookableDate } from "@/lib/policies";

const now = new Date("2030-03-04T07:00:00Z");
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("clientCancellation", () => {
  it("allows cancelling 24 hours or more before", () => {
    expect(clientCancellation(hoursFromNow(24), now)).toEqual({ allowed: true });
    expect(clientCancellation(hoursFromNow(72), now)).toEqual({ allowed: true });
  });

  it("refuses inside the cut-off and explains what to do instead", () => {
    const decision = clientCancellation(hoursFromNow(23.99), now);
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toMatch(/24 hours.*Call the clinic/);
  });

  it("refuses once the appointment has started", () => {
    expect(clientCancellation(hoursFromNow(0), now)).toMatchObject({ allowed: false, reason: expect.stringMatching(/started/) });
  });
});

describe("booking window", () => {
  it("starts on today's local date and lasts the configured number of days", () => {
    const dates = bookableDates(new Date("2030-03-03T23:30:00Z")); // already 4 March in Prague
    expect(dates[0]).toBe("2030-03-04");
    expect(dates).toHaveLength(BOOKING_RULES.bookingWindowDays);
    expect(dates.at(-1)).toBe("2030-03-17");
  });

  it("rejects past and too-distant dates", () => {
    expect(isBookableDate("2030-03-03", now)).toBe(false);
    expect(isBookableDate("2030-03-18", now)).toBe(false);
    expect(isBookableDate("2030-03-10", now)).toBe(true);
  });
});

it("holds expire after the configured minutes", () => {
  expect(holdExpiry(now).toISOString()).toBe("2030-03-04T07:10:00.000Z");
});
