import { addDays, dayKeyOf } from './dates';
import { atTime, isTrainingDay, sessionTimeFor } from './schedule';
import type { DayKey, Schedule } from './types';

export interface PlannedReminder {
  id: string;
  date: Date;
  title: string;
  body: string;
  day: DayKey;
  kind: 'session' | 'comeback';
}

export interface ReminderContext {
  heroName: string;
  streak: number;
  /** Day keys that already have a completed workout. */
  completedDays: ReadonlySet<DayKey>;
  /** Name of the next program day, such as "Push A". */
  nextDayName: string;
  floor: number;
  dragonName: string;
}

const LINES = [
  (c: ReminderContext) => `Floor ${c.floor} is waiting, ${c.heroName}. Today: ${c.nextDayName}.`,
  (c: ReminderContext) => `Your torch is lit. ${c.nextDayName} is on the board.`,
  (c: ReminderContext) => `${c.dragonName} grows bolder when you rest too long. ${c.nextDayName} today.`,
  (c: ReminderContext) => `The gate will not open itself. Time for ${c.nextDayName}.`,
  (c: ReminderContext) => `Steel sharpened, boots laced. ${c.nextDayName} starts now.`,
];

/**
 * Concrete reminders for the next `days` days. A rolling window of dated
 * notifications (rather than one repeating trigger) lets a single day move
 * earlier or later, or become a rest day, without touching the rest of the
 * week. Re-plan whenever the app opens or the schedule changes.
 */
export function planReminders(
  schedule: Schedule,
  now: Date,
  context: ReminderContext,
  days = 14,
): PlannedReminder[] {
  if (!schedule.remindersEnabled) return [];
  const today = dayKeyOf(now);
  const reminders: PlannedReminder[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    if (!isTrainingDay(schedule, day) || context.completedDays.has(day)) continue;
    const date = atTime(day, sessionTimeFor(schedule, day));
    if (date.getTime() <= now.getTime() + 60_000) continue;
    const streakLine = context.streak >= 3 ? ` Keep your ${context.streak}-day streak alive.` : '';
    reminders.push({
      id: `session-${day}`,
      day,
      date,
      kind: 'session',
      title: 'Your quest awaits',
      body: LINES[i % LINES.length](context) + streakLine,
    });
  }

  // If the lifter never opens the app again inside the window, one last nudge.
  const lastDay = addDays(today, days);
  reminders.push({
    id: `comeback-${lastDay}`,
    day: lastDay,
    date: atTime(lastDay, schedule.reminderTime),
    kind: 'comeback',
    title: 'The dungeon has gone quiet',
    body: `${context.heroName}, your gear is gathering dust. One short session gets the fire going again.`,
  });
  return reminders;
}

export interface MoveOption {
  label: string;
  hour: number;
  minute: number;
}

/** Quick picks for moving today's session. */
export function moveOptions(now: Date): MoveOption[] {
  const options: MoveOption[] = [
    { label: 'Early morning', hour: 6, minute: 30 },
    { label: 'Morning', hour: 9, minute: 0 },
    { label: 'Lunch', hour: 12, minute: 30 },
    { label: 'Afternoon', hour: 16, minute: 0 },
    { label: 'Evening', hour: 18, minute: 30 },
    { label: 'Night', hour: 20, minute: 30 },
  ];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const later = options.filter((o) => o.hour * 60 + o.minute > minutesNow + 15);
  const inAnHour = new Date(now.getTime() + 60 * 60_000);
  return [
    { label: 'In an hour', hour: inAnHour.getHours(), minute: Math.floor(inAnHour.getMinutes() / 5) * 5 },
    ...later,
  ];
}

/** Swap today with the next rest day: rest now, train on that day instead. */
export function swapRestDay(schedule: Schedule, today: DayKey): Schedule {
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, i);
    if (!isTrainingDay(schedule, day)) {
      return { ...schedule, overrides: { ...schedule.overrides, [today]: 'rest', [day]: 'train' } };
    }
  }
  return { ...schedule, overrides: { ...schedule.overrides, [today]: 'rest' } };
}
