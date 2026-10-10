import { describe, expect, it } from "vitest";
import { computeSlots, mergeSlots, overlaps, type SlotInput } from "@/lib/availability";
import { zonedTimeToUtc } from "@/lib/time";

const TZ = "Europe/Prague";
const at = (date: string, clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return zonedTimeToUtc(date, h * 60 + m, TZ);
};
const clocks = (date: string, slots: number[]) =>
  slots.map((s) => new Date(s).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }));

const base: SlotInput = {
  date: "2030-03-05",
  timeZone: TZ,
  durationMinutes: 60,
  stepMinutes: 30,
  windows: [{ startMinute: 8 * 60, endMinute: 11 * 60 }],
  busy: [],
  now: at("2030-03-04", "08:00"),
  minLeadMinutes: 120,
};

describe("computeSlots", () => {
  it("offers every step where the whole service fits in the window", () => {
    expect(clocks(base.date, computeSlots(base))).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00"]);
  });

  it("respects breaks between working windows", () => {
    const slots = computeSlots({
      ...base,
      windows: [
        { startMinute: 8 * 60, endMinute: 9 * 60 },
        { startMinute: 9 * 60 + 30, endMinute: 11 * 60 },
      ],
    });
    expect(clocks(base.date, slots)).toEqual(["08:00", "09:30", "10:00"]);
  });

  it("skips anything overlapping a busy interval but allows back-to-back", () => {
    const busy = [{ start: at(base.date, "09:00"), end: at(base.date, "10:00") }];
    expect(clocks(base.date, computeSlots({ ...base, busy }))).toEqual(["08:00", "10:00"]);
  });

  it("enforces the minimum notice", () => {
    const now = at(base.date, "07:15");
    expect(clocks(base.date, computeSlots({ ...base, now }))).toEqual(["09:30", "10:00"]);
  });

  it("returns nothing on a day without working hours", () => {
    expect(computeSlots({ ...base, windows: [] })).toEqual([]);
  });

  it("produces the same local times on the day clocks change", () => {
    const slots = computeSlots({ ...base, date: "2030-03-31", now: at("2030-03-30", "08:00") });
    expect(clocks("2030-03-31", slots)).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00"]);
  });

  it("returns sorted unique instants even with overlapping windows", () => {
    const slots = computeSlots({
      ...base,
      windows: [
        { startMinute: 9 * 60, endMinute: 11 * 60 },
        { startMinute: 8 * 60, endMinute: 10 * 60 },
      ],
    });
    expect(slots).toEqual([...new Set(slots)].sort((a, b) => a - b));
  });
});

describe("mergeSlots", () => {
  it("keeps one entry per time and prefers the earlier therapist in the list", () => {
    expect(
      mergeSlots([
        { therapistId: "emma", slots: [2, 3] },
        { therapistId: "mark", slots: [1, 3] },
      ]),
    ).toEqual([
      { startsAt: 1, therapistId: "mark" },
      { startsAt: 2, therapistId: "emma" },
      { startsAt: 3, therapistId: "emma" },
    ]);
  });
});

it("overlaps treats touching intervals as free", () => {
  expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
  expect(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true);
});
