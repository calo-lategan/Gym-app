import { addDays, dayKeyOf, parseDayKey, weekdayOf } from './dates';
import type { ClockTime, DayKey, Schedule } from './types';

export function defaultSchedule(): Schedule {
  // Monday, Tuesday, Thursday, Friday training; the rest are rest days.
  return {
    trainingDays: [false, true, true, false, true, true, false],
    reminderTime: { hour: 18, minute: 0 },
    remindersEnabled: true,
    overrides: {},
  };
}

export function isTrainingDay(schedule: Schedule, day: DayKey): boolean {
  const override = schedule.overrides[day];
  if (override === 'rest') return false;
  if (override === 'train' || (override && typeof override === 'object')) return true;
  return Boolean(schedule.trainingDays[weekdayOf(day)]);
}

export function sessionTimeFor(schedule: Schedule, day: DayKey): ClockTime {
  const override = schedule.overrides[day];
  return override && typeof override === 'object' ? override : schedule.reminderTime;
}

export function trainingDaysPerWeek(schedule: Schedule): number {
  return schedule.trainingDays.filter(Boolean).length;
}

/** Next training day strictly after `day` (or `day` itself when `inclusive`). */
export function nextTrainingDay(schedule: Schedule, day: DayKey, inclusive = false): DayKey | null {
  for (let i = inclusive ? 0 : 1; i <= 14; i++) {
    const candidate = addDays(day, i);
    if (isTrainingDay(schedule, candidate)) return candidate;
  }
  return null;
}

export function atTime(day: DayKey, time: ClockTime): Date {
  const d = parseDayKey(day);
  d.setHours(time.hour, time.minute, 0, 0);
  return d;
}

export function formatClock(time: ClockTime, use24h = false): string {
  if (use24h) return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  const suffix = time.hour < 12 ? 'am' : 'pm';
  const h = time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${h}:${String(time.minute).padStart(2, '0')} ${suffix}`;
}

/** Drop overrides for days that have passed, so the map does not grow forever. */
export function pruneOverrides(schedule: Schedule, today: DayKey): Schedule {
  const overrides = Object.fromEntries(Object.entries(schedule.overrides).filter(([day]) => day >= today));
  return { ...schedule, overrides };
}

export const todayKey = () => dayKeyOf(new Date());
