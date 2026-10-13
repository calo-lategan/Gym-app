import { addDays, daysBetween } from '../dates';
import { isTrainingDay } from '../schedule';
import type { DayKey, Hero, Schedule } from '../types';

export type StreakEvent =
  | { type: 'shield_used'; day: DayKey }
  | { type: 'streak_lost'; day: DayKey; lost: number };

/**
 * Settles every scheduled day between the last evaluated day and yesterday.
 * Rest days never count against the streak. A missed training day uses a
 * Potion of Resolve if one is held, otherwise the streak resets.
 */
export function settleStreak(
  hero: Hero,
  schedule: Schedule,
  completedDays: ReadonlySet<DayKey>,
  today: DayKey,
): { hero: Hero; events: StreakEvent[] } {
  const yesterday = addDays(today, -1);
  const start = hero.streak.lastEvaluated ? addDays(hero.streak.lastEvaluated, 1) : null;
  if (!start || daysBetween(start, yesterday) < 0) return { hero, events: [] };

  let { current, best } = hero.streak;
  let resolve = hero.potions.resolve;
  const events: StreakEvent[] = [];
  // Cap the walk so a long absence does not loop for ages.
  const from = daysBetween(start, yesterday) > 60 ? addDays(yesterday, -60) : start;

  for (let day = from; daysBetween(day, yesterday) >= 0; day = addDays(day, 1)) {
    if (!isTrainingDay(schedule, day)) continue;
    if (completedDays.has(day)) {
      current += 1;
      best = Math.max(best, current);
    } else if (resolve > 0 && current > 0) {
      resolve -= 1;
      events.push({ type: 'shield_used', day });
    } else if (current > 0) {
      events.push({ type: 'streak_lost', day, lost: current });
      current = 0;
    }
  }

  return {
    hero: {
      ...hero,
      potions: { ...hero.potions, resolve },
      streak: { current, best, lastEvaluated: yesterday },
    },
    events,
  };
}

/** Called when a scheduled workout is completed today: the streak grows immediately. */
export function creditToday(hero: Hero, today: DayKey): Hero {
  if (hero.streak.lastEvaluated === today) return hero;
  const current = hero.streak.current + 1;
  return {
    ...hero,
    streak: { current, best: Math.max(hero.streak.best, current), lastEvaluated: today },
  };
}

export function streakBonusPct(streak: number, perDay: number, cap: number): number {
  return Math.min(cap, streak * perDay);
}
