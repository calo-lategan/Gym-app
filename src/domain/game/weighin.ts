import { averageWeight } from '../science';
import type { DayKey, Goal, Hero, WeighIn } from '../types';
import { BALANCE } from './balance';
import { addXp } from './progression';

export interface WeighInOutcome {
  hero: Hero;
  newMilestones: number;
  xp: number;
  gold: number;
  levelsGained: number;
  /** Progress toward the target in kg, measured on the 7-day average. */
  progressKg: number;
}

/** One milestone per 1% of starting body weight moved toward the goal (at least 0.5 kg). */
export function milestoneStepKg(goal: Goal): number {
  return Math.max(0.5, Math.round(goal.start * 0.01 * 10) / 10);
}

/**
 * Rewards body weight moving the right way. It uses the 7-day average so a
 * single dehydrated morning cannot be farmed, and each milestone pays once.
 */
export function resolveWeighIn(hero: Hero, goal: Goal, weighIns: readonly WeighIn[], today: DayKey, firstWeighInToday: boolean): WeighInOutcome {
  let xp = firstWeighInToday ? BALANCE.xp.weighIn : 0;
  let gold = 0;
  let newMilestones = 0;
  let progressKg = 0;
  let next = hero;

  if (goal.kind === 'bodyweight') {
    const avg = averageWeight(weighIns, today);
    if (avg !== null) {
      const direction = goal.target < goal.start ? -1 : 1;
      progressKg = Math.max(0, (avg - goal.start) * direction);
      const reached = Math.floor(progressKg / milestoneStepKg(goal) + 1e-9);
      newMilestones = Math.max(0, reached - hero.weightMilestones);
      if (newMilestones > 0) {
        xp += newMilestones * BALANCE.xp.weightMilestone;
        gold += newMilestones * BALANCE.gold.weightMilestone;
        next = {
          ...next,
          weightMilestones: reached,
          stats: { ...next.stats, vit: next.stats.vit + newMilestones },
        };
      }
    }
  }

  const result = addXp(next, xp);
  next = { ...result.hero, gold: result.hero.gold + gold };
  return { hero: next, newMilestones, xp, gold, levelsGained: result.levelsGained, progressKg };
}

/** Recovery check-in: small XP, and Vitality every few check-ins. */
export function resolveCheckIn(hero: Hero, firstToday: boolean): { hero: Hero; xp: number; vit: number; levelsGained: number } {
  if (!firstToday) return { hero, xp: 0, vit: 0, levelsGained: 0 };
  const checkIns = hero.checkIns + 1;
  const vit = checkIns % BALANCE.stats.checkInsPerVit === 0 ? 1 : 0;
  const result = addXp({ ...hero, checkIns, stats: { ...hero.stats, vit: hero.stats.vit + vit } }, BALANCE.xp.checkIn);
  return { hero: result.hero, xp: BALANCE.xp.checkIn, vit, levelsGained: result.levelsGained };
}
