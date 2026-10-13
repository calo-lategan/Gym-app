import { findExercise } from '../exercises';
import type { ExerciseRecord } from '../records';
import { estimateOneRepMax, loadIncrement, roundLoad } from '../strength';
import type { BossChallenge, BossState, Program, SetLog, WeightUnit } from '../types';
import { bossNameForFloor } from './dungeon';

/**
 * Builds a miniboss challenge from the lifter's current numbers so it is
 * always a small, reachable step past their best: two more reps at a load
 * they already handle, about 2.5% more estimated strength, or ten seconds
 * longer on a hold.
 */
export function createBossChallenge(
  floor: number,
  program: Program,
  records: Record<string, ExerciseRecord>,
  unit: WeightUnit = 'kg',
): BossChallenge {
  const bossIndex = Math.floor(floor / 5);
  const candidates = [...new Set(program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))]
    .map((id) => findExercise(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e && records[e.id] && e.kind !== 'mobility' && e.kind !== 'conditioning'));

  const weighted = candidates.filter((e) => e.externalLoad && e.kind === 'compound' && records[e.id].bestE1rm > 0);
  const bodyweight = candidates.filter((e) => !e.externalLoad && e.measure === 'reps');
  const holds = candidates.filter((e) => e.measure === 'time' && records[e.id].bestHold > 0);

  if (weighted.length > 0 && bossIndex % 2 === 0) {
    const exercise = weighted[(bossIndex / 2) % weighted.length];
    const record = records[exercise.id];
    const reps = 5;
    let weight = roundLoad((record.bestE1rm * 1.025) / (1 + reps / 30), exercise, unit);
    const bestAtFive = Object.entries(record.repsAtLoad)
      .filter(([, r]) => r >= reps)
      .reduce((max, [load]) => Math.max(max, Number(load)), 0);
    if (weight <= bestAtFive) weight = roundLoad(bestAtFive + loadIncrement(exercise, unit), exercise, unit);
    return { exerciseId: exercise.id, kind: 'weight', weight, target: reps };
  }

  const repPool = [...weighted, ...bodyweight];
  if (repPool.length > 0) {
    const exercise = repPool[bossIndex % repPool.length];
    const record = records[exercise.id];
    const load = exercise.externalLoad ? record.bestWeight : 0;
    const best = record.repsAtLoad[String(Math.round(load * 4) / 4)] ?? record.bestWeightReps;
    const target = exercise.externalLoad ? Math.max(6, best + 2) : Math.max(best + 2, Math.ceil(best * 1.1));
    return { exerciseId: exercise.id, kind: 'reps', weight: load, target };
  }

  if (holds.length > 0) {
    const exercise = holds[0];
    return { exerciseId: exercise.id, kind: 'hold', weight: 0, target: records[exercise.id].bestHold + 10 };
  }

  return { exerciseId: 'push_up', kind: 'reps', weight: 0, target: 12 };
}

export function createBoss(
  floor: number,
  week: string,
  program: Program,
  records: Record<string, ExerciseRecord>,
  unit: WeightUnit = 'kg',
): BossState {
  return {
    id: `boss-${floor}`,
    name: bossNameForFloor(floor),
    floor,
    challenge: createBossChallenge(floor, program, records, unit),
    week,
    lastAttemptWeek: null,
    attempts: 0,
  };
}

/** One attempt per ISO week keeps minibosses an event rather than a grind. */
export function canAttemptBoss(boss: BossState, week: string): boolean {
  return boss.lastAttemptWeek !== week;
}

export function bossSetSucceeds(challenge: BossChallenge, set: SetLog): boolean {
  return set.reps >= challenge.target && set.weight >= challenge.weight - 0.01;
}

/** Refresh a waiting boss at the start of a new week so it tracks current form. */
export function refreshBossForWeek(
  boss: BossState,
  week: string,
  program: Program,
  records: Record<string, ExerciseRecord>,
  unit: WeightUnit = 'kg',
): BossState {
  if (boss.week === week) return boss;
  return { ...boss, week, challenge: createBossChallenge(boss.floor, program, records, unit) };
}

export function describeChallenge(challenge: BossChallenge, formatLoad: (kg: number) => string): string {
  const exercise = findExercise(challenge.exerciseId);
  const name = exercise?.name ?? 'Exercise';
  if (challenge.kind === 'hold') return `${name}: hold for ${challenge.target} seconds`;
  if (challenge.weight > 0) return `${name}: ${challenge.target} reps at ${formatLoad(challenge.weight)}`;
  return `${name}: ${challenge.target} reps in one set`;
}

/** Estimated 1RM the challenge represents, for the boss health bar. */
export function challengeStrength(challenge: BossChallenge): number {
  return challenge.weight > 0 ? estimateOneRepMax(challenge.weight, challenge.target) : challenge.target;
}
