/**
 * Time-zone helpers built on Intl only. The clinic works in Europe/Prague; all
 * instants are stored in UTC and converted at the edges. DST is handled by looking
 * up the real offset for each instant instead of assuming a fixed one.
 */
export const CLINIC_TIME_ZONE = "Europe/Prague";
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(instant: number, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `timeZone` from UTC at the given instant, in ms (CET = +1h, CEST = +2h). */
export function timeZoneOffset(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function isValidDate(date: string): boolean {
  const match = DATE_RE.exec(date);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

function splitDate(date: string) {
  if (!isValidDate(date)) throw new RangeError(`Invalid date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/**
 * The UTC instant of a local wall-clock time. Times that don't exist (the skipped
 * hour when clocks spring forward) resolve to the instant after the gap.
 */
export function zonedTimeToUtc(date: string, minuteOfDay: number, timeZone: string): number {
  const { y, m, d } = splitDate(date);
  const wallClock = Date.UTC(y, m - 1, d, 0, minuteOfDay);
  const firstGuess = wallClock - timeZoneOffset(wallClock, timeZone);
  const offset = timeZoneOffset(firstGuess, timeZone);
  return wallClock - offset;
}

/** Local calendar date (YYYY-MM-DD) of an instant. */
export function localDate(instant: number, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function localMinuteOfDay(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = splitDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const { y, m, d } = splitDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** Parses an <input type="datetime-local"> value as clinic-local time. */
export function parseLocalDateTime(value: string, timeZone: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match || !isValidDate(match[1])) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return null;
  return zonedTimeToUtc(match[1], hours * 60 + minutes, timeZone);
}

const display = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, ...options });

const timeFormat = display({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFormat = display({ weekday: "short", day: "numeric", month: "short" });
const longDayFormat = display({ weekday: "long", day: "numeric", month: "long" });

export const formatTime = (instant: Date | number) => timeFormat.format(instant);
export const formatDay = (instant: Date | number) => dayFormat.format(instant);
export const formatLongDay = (instant: Date | number) => longDayFormat.format(instant);
export const formatDateTime = (instant: Date | number) => `${formatLongDay(instant)} at ${formatTime(instant)}`;

/** Noon on a local date: a safe instant for formatting the date itself. */
export const dateToInstant = (date: string) => zonedTimeToUtc(date, 12 * 60, CLINIC_TIME_ZONE);

export function minutesToClock(minuteOfDay: number): string {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;
}
