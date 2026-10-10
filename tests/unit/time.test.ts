import { describe, expect, it } from "vitest";
import {
  addDays,
  isoWeekday,
  isValidDate,
  localDate,
  localMinuteOfDay,
  parseLocalDateTime,
  startOfWeek,
  timeZoneOffset,
  zonedTimeToUtc,
} from "@/lib/time";

const TZ = "Europe/Prague";
const HOUR = 3_600_000;

describe("timeZoneOffset", () => {
  it("is +1h in winter and +2h in summer", () => {
    expect(timeZoneOffset(Date.parse("2030-01-15T12:00:00Z"), TZ)).toBe(HOUR);
    expect(timeZoneOffset(Date.parse("2030-07-15T12:00:00Z"), TZ)).toBe(2 * HOUR);
  });
});

describe("zonedTimeToUtc", () => {
  it("converts wall-clock time in winter and summer", () => {
    expect(new Date(zonedTimeToUtc("2030-03-04", 8 * 60, TZ)).toISOString()).toBe("2030-03-04T07:00:00.000Z");
    expect(new Date(zonedTimeToUtc("2030-07-01", 8 * 60, TZ)).toISOString()).toBe("2030-07-01T06:00:00.000Z");
  });

  it("handles the day clocks go forward (31 March 2030)", () => {
    expect(new Date(zonedTimeToUtc("2030-03-31", 1 * 60, TZ)).toISOString()).toBe("2030-03-31T00:00:00.000Z");
    expect(new Date(zonedTimeToUtc("2030-03-31", 4 * 60, TZ)).toISOString()).toBe("2030-03-31T02:00:00.000Z");
    // 02:30 doesn't exist that night; it resolves to 03:30 summer time.
    const gap = zonedTimeToUtc("2030-03-31", 2 * 60 + 30, TZ);
    expect(localMinuteOfDay(gap, TZ)).toBe(3 * 60 + 30);
  });

  it("handles the day clocks go back (27 October 2030)", () => {
    expect(new Date(zonedTimeToUtc("2030-10-27", 9 * 60, TZ)).toISOString()).toBe("2030-10-27T08:00:00.000Z");
    expect(localMinuteOfDay(zonedTimeToUtc("2030-10-27", 2 * 60 + 30, TZ), TZ)).toBe(2 * 60 + 30);
  });

  it("round-trips every quarter hour of an ordinary day", () => {
    for (let minute = 0; minute < 1440; minute += 15) {
      const instant = zonedTimeToUtc("2030-05-14", minute, TZ);
      expect(localDate(instant, TZ)).toBe("2030-05-14");
      expect(localMinuteOfDay(instant, TZ)).toBe(minute);
    }
  });
});

describe("calendar helpers", () => {
  it("uses the local date, not the UTC one, around midnight", () => {
    expect(localDate(Date.parse("2030-03-03T23:30:00Z"), TZ)).toBe("2030-03-04");
  });

  it("adds days across months and years", () => {
    expect(addDays("2030-02-27", 2)).toBe("2030-03-01");
    expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
    expect(addDays("2030-03-04", -1)).toBe("2030-03-03");
  });

  it("knows weekdays and the start of the week", () => {
    expect(isoWeekday("2030-03-04")).toBe(1);
    expect(isoWeekday("2030-03-10")).toBe(7);
    expect(startOfWeek("2030-03-10")).toBe("2030-03-04");
    expect(startOfWeek("2030-03-04")).toBe("2030-03-04");
  });

  it("validates dates strictly", () => {
    expect(isValidDate("2030-02-28")).toBe(true);
    expect(isValidDate("2030-02-30")).toBe(false);
    expect(isValidDate("2030-2-3")).toBe(false);
    expect(() => addDays("nonsense", 1)).toThrow(RangeError);
  });

  it("parses datetime-local input as clinic time", () => {
    expect(new Date(parseLocalDateTime("2030-03-05T12:00", TZ)!).toISOString()).toBe("2030-03-05T11:00:00.000Z");
    expect(parseLocalDateTime("2030-03-05T25:00", TZ)).toBeNull();
    expect(parseLocalDateTime("2030-03-05", TZ)).toBeNull();
  });
});
