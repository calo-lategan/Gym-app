import { estimateOneRepMax, formatWeight } from './strength';
import type { DayKey, Exercise, SetLog, WeightUnit } from './types';

export interface ExerciseRecord {
  exerciseId: string;
  bestE1rm: number;
  /** Heaviest load lifted for at least one rep, in kg. */
  bestWeight: number;
  bestWeightReps: number;
  /** Best reps per load (kg, rounded to 0.25) as a string key. */
  repsAtLoad: Record<string, number>;
  /** Longest hold in seconds, for timed exercises. */
  bestHold: number;
  /** Fastest set duration in seconds per `${load}x${reps}`. */
  fastest: Record<string, number>;
  lastDay: DayKey;
}

export type PrKind = 'weight' | 'e1rm' | 'reps' | 'hold' | 'speed';

export interface PrEvent {
  exerciseId: string;
  kind: PrKind;
  setId: string;
  value: number;
  previous: number;
  /** Load in kg the PR was set at (0 for body weight). */
  weight: number;
  reps: number;
}

/** Minimum improvement for a speed PR, so timer noise does not count. */
const SPEED_MARGIN = 0.95;
/** Faster than one second per rep is not a real set. */
const MIN_SECONDS_PER_REP = 1;

export const loadKey = (kg: number) => String(Math.round(kg * 4) / 4);
const speedKey = (kg: number, reps: number) => `${loadKey(kg)}x${reps}`;

export function setDuration(set: SetLog): number | null {
  if (set.untimed) return null;
  const seconds = (set.endedAt - set.startedAt) / 1000;
  return seconds > 0 ? seconds : null;
}

export function emptyRecord(exerciseId: string, day: DayKey): ExerciseRecord {
  return {
    exerciseId,
    bestE1rm: 0,
    bestWeight: 0,
    bestWeightReps: 0,
    repsAtLoad: {},
    bestHold: 0,
    fastest: {},
    lastDay: day,
  };
}

function bestRepsAtOrAbove(record: ExerciseRecord, kg: number): number | null {
  let best: number | null = null;
  for (const [key, reps] of Object.entries(record.repsAtLoad)) {
    if (Number(key) >= Math.round(kg * 4) / 4 && (best === null || reps > best)) best = reps;
  }
  return best;
}

/**
 * PRs a set earns against a record. A first-ever set only records a baseline,
 * so nothing is a PR until there is something to beat.
 */
export function detectPrs(record: ExerciseRecord | undefined, set: SetLog, exercise: Exercise): PrEvent[] {
  if (!record || set.reps <= 0) return [];
  const base = { exerciseId: exercise.id, setId: set.id, weight: set.weight, reps: set.reps };
  const events: PrEvent[] = [];

  if (exercise.measure === 'time') {
    if (record.bestHold > 0 && set.reps > record.bestHold) {
      events.push({ ...base, kind: 'hold', value: set.reps, previous: record.bestHold });
    }
    return events;
  }

  if (exercise.externalLoad && set.weight > 0) {
    if (record.bestWeight > 0 && set.weight > record.bestWeight + 0.01) {
      events.push({ ...base, kind: 'weight', value: set.weight, previous: record.bestWeight });
    }
    const e1rm = estimateOneRepMax(set.weight, set.reps);
    if (record.bestE1rm > 0 && set.reps <= 12 && e1rm > record.bestE1rm * 1.005) {
      events.push({ ...base, kind: 'e1rm', value: e1rm, previous: record.bestE1rm });
    }
  }

  const previousReps = bestRepsAtOrAbove(record, set.weight);
  if (previousReps !== null && set.reps > previousReps) {
    events.push({ ...base, kind: 'reps', value: set.reps, previous: previousReps });
  }

  const duration = setDuration(set);
  const fastest = record.fastest[speedKey(set.weight, set.reps)];
  if (duration !== null && fastest !== undefined && duration >= set.reps * MIN_SECONDS_PER_REP && duration <= fastest * SPEED_MARGIN) {
    events.push({ ...base, kind: 'speed', value: duration, previous: fastest });
  }
  return events;
}

/** Fold a set into a record. Pure: returns a new record. */
export function applySet(record: ExerciseRecord | undefined, set: SetLog, exercise: Exercise, day: DayKey): ExerciseRecord {
  const next: ExerciseRecord = record
    ? { ...record, repsAtLoad: { ...record.repsAtLoad }, fastest: { ...record.fastest } }
    : emptyRecord(exercise.id, day);
  next.lastDay = day;
  if (set.reps <= 0) return next;

  if (exercise.measure === 'time') {
    next.bestHold = Math.max(next.bestHold, set.reps);
    return next;
  }

  if (set.weight > next.bestWeight || (set.weight === next.bestWeight && set.reps > next.bestWeightReps)) {
    next.bestWeight = set.weight;
    next.bestWeightReps = set.reps;
  }
  if (exercise.externalLoad) {
    next.bestE1rm = Math.max(next.bestE1rm, estimateOneRepMax(set.weight, Math.min(set.reps, 12)));
  }
  const key = loadKey(set.weight);
  next.repsAtLoad[key] = Math.max(next.repsAtLoad[key] ?? 0, set.reps);

  const duration = setDuration(set);
  if (duration !== null && duration >= set.reps * MIN_SECONDS_PER_REP) {
    const sk = speedKey(set.weight, set.reps);
    next.fastest[sk] = Math.min(next.fastest[sk] ?? Infinity, duration);
  }
  return next;
}

/** PRs for one new set given the record at session start and earlier sets this session. */
export function prsForNewSet(
  preSession: ExerciseRecord | undefined,
  earlierSets: readonly SetLog[],
  set: SetLog,
  exercise: Exercise,
  day: DayKey,
): PrEvent[] {
  if (!preSession) return [];
  const working = earlierSets.reduce((r, s) => applySet(r, s, exercise, day), preSession);
  return detectPrs(working, set, exercise);
}

export const PR_LABELS: Record<PrKind, string> = {
  weight: 'Heaviest lift',
  e1rm: 'Strength record',
  reps: 'Rep record',
  hold: 'Longest hold',
  speed: 'Fastest set',
};

/** One-line description of what a record was set at, for reward screens. */
export function prSummary(pr: PrEvent, unit: WeightUnit): string {
  switch (pr.kind) {
    case 'weight':
      return `${formatWeight(pr.value, unit)} for ${pr.reps} ${pr.reps === 1 ? 'rep' : 'reps'}`;
    case 'e1rm':
      return `Estimated max ${formatWeight(pr.value, unit)}, up from ${formatWeight(pr.previous, unit)}`;
    case 'reps':
      return pr.weight > 0
        ? `${pr.value} reps at ${formatWeight(pr.weight, unit)}, up from ${pr.previous}`
        : `${pr.value} reps, up from ${pr.previous}`;
    case 'hold':
      return `${pr.value} s hold, up from ${pr.previous} s`;
    case 'speed':
      return `${pr.reps} reps in ${Math.round(pr.value)} s, down from ${Math.round(pr.previous)} s`;
  }
}

/** Keep the strongest PR of each kind per exercise. */
export function dedupePrs(events: readonly PrEvent[]): PrEvent[] {
  const best = new Map<string, PrEvent>();
  for (const event of events) {
    const key = `${event.exerciseId}:${event.kind}`;
    const current = best.get(key);
    const better = !current || (event.kind === 'speed' ? event.value < current.value : event.value > current.value);
    if (better) best.set(key, event);
  }
  return [...best.values()];
}
