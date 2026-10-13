import type { DayKey, Weekday } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day for a date or timestamp. */
export function dayKeyOf(date: Date | number): DayKey {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight for a day key. */
export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKeyOf(d);
}

/** Whole days from `a` to `b` (negative when `b` is earlier). DST-safe. */
export function daysBetween(a: DayKey, b: DayKey): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function weekdayOf(key: DayKey): Weekday {
  return parseDayKey(key).getDay() as Weekday;
}

/** ISO-8601 week key such as `2026-W42`. Weeks start on Monday. */
export function isoWeekKey(key: DayKey): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** Monday of the ISO week containing `key`. */
export function startOfIsoWeek(key: DayKey): DayKey {
  const weekday = weekdayOf(key);
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(key, offset);
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
