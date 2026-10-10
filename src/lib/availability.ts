import { MINUTE, zonedTimeToUtc } from "./time";

export type Interval = { start: number; end: number };
export type WorkingWindow = { startMinute: number; endMinute: number };

export type SlotInput = {
  date: string;
  timeZone: string;
  durationMinutes: number;
  stepMinutes: number;
  windows: WorkingWindow[];
  busy: Interval[];
  now: number;
  minLeadMinutes: number;
};

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Pure availability engine: every start time on `date` where a service of the given
 * length fits inside working hours, doesn't touch anything busy and respects the
 * minimum notice. Returns UTC instants in ascending order.
 */
export function computeSlots(input: SlotInput): number[] {
  const earliest = input.now + input.minLeadMinutes * MINUTE;
  const slots = new Set<number>();

  for (const window of input.windows) {
    const windowEnd = zonedTimeToUtc(input.date, window.endMinute, input.timeZone);
    for (
      let minute = window.startMinute;
      minute + input.durationMinutes <= window.endMinute;
      minute += input.stepMinutes
    ) {
      const start = zonedTimeToUtc(input.date, minute, input.timeZone);
      const slot = { start, end: start + input.durationMinutes * MINUTE };
      if (start < earliest || slot.end > windowEnd) continue;
      if (input.busy.some((busy) => overlaps(slot, busy))) continue;
      slots.add(start);
    }
  }
  return [...slots].sort((a, b) => a - b);
}

export type TherapistSlot = { startsAt: number; therapistId: string };

/**
 * For "any therapist": one entry per start time, assigned to the first therapist in
 * the given order who is free. Ordering is deterministic so the UI and server agree.
 */
export function mergeSlots(perTherapist: { therapistId: string; slots: number[] }[]): TherapistSlot[] {
  const byTime = new Map<number, string>();
  for (const { therapistId, slots } of perTherapist) {
    for (const start of slots) if (!byTime.has(start)) byTime.set(start, therapistId);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startsAt, therapistId]) => ({ startsAt, therapistId }));
}
