import { addDays, daysBetween } from './dates';
import { findExercise } from './exercises';
import type { ExerciseRecord } from './records';
import { loadIncrement } from './strength';
import type {
  DayKey,
  Exercise,
  Focus,
  GoalKind,
  MuscleGroup,
  ProgramDay,
  WeighIn,
  WeightUnit,
  WorkoutSession,
} from './types';

/**
 * Weekly hard-set landmarks per muscle group: MEV is the least volume that
 * reliably produces growth, MRV the most a typical lifter recovers from.
 * Values follow the Renaissance Periodization volume landmarks and the
 * Schoenfeld et al. (2017) dose-response meta-analysis. Individuals vary, so
 * these drive gentle warnings, never hard blocks.
 */
export const VOLUME_LANDMARKS: Record<MuscleGroup, { mev: number; mrv: number }> = {
  chest: { mev: 8, mrv: 22 },
  back: { mev: 10, mrv: 25 },
  shoulders: { mev: 8, mrv: 26 },
  biceps: { mev: 8, mrv: 26 },
  triceps: { mev: 6, mrv: 18 },
  quads: { mev: 8, mrv: 20 },
  hamstrings: { mev: 6, mrv: 20 },
  glutes: { mev: 4, mrv: 16 },
  calves: { mev: 8, mrv: 20 },
  core: { mev: 0, mrv: 25 },
};

/** Large muscles typically need 48 to 72 hours between hard sessions, small ones 24 to 48. */
const LARGE_MUSCLES: MuscleGroup[] = ['chest', 'back', 'quads', 'hamstrings', 'glutes'];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
};

const emptyMuscles = (): Record<MuscleGroup, number> => ({
  chest: 0,
  back: 0,
  shoulders: 0,
  biceps: 0,
  triceps: 0,
  quads: 0,
  hamstrings: 0,
  glutes: 0,
  calves: 0,
  core: 0,
});

/** Primary muscles count a full set, secondary muscles half a set. */
function addSetToMuscles(totals: Record<MuscleGroup, number>, exercise: Exercise, sets = 1) {
  if (exercise.kind === 'mobility') return;
  for (const m of exercise.primary) totals[m] += sets;
  for (const m of exercise.secondary) totals[m] += sets * 0.5;
}

/** Fractional hard sets per muscle over the `days` days ending on `endDay` (inclusive). */
export function weeklySets(
  sessions: readonly WorkoutSession[],
  endDay: DayKey,
  days = 7,
): Record<MuscleGroup, number> {
  const totals = emptyMuscles();
  for (const session of sessions) {
    const age = daysBetween(session.dayKey, endDay);
    if (age < 0 || age >= days) continue;
    for (const ex of session.exercises) {
      const exercise = findExercise(ex.exerciseId);
      if (!exercise) continue;
      addSetToMuscles(totals, exercise, ex.sets.filter((s) => s.reps > 0).length);
    }
  }
  return totals;
}

export function plannedSets(day: ProgramDay): Record<MuscleGroup, number> {
  const totals = emptyMuscles();
  for (const planned of day.exercises) {
    const exercise = findExercise(planned.exerciseId);
    if (exercise) addSetToMuscles(totals, exercise, planned.sets);
  }
  return totals;
}

/** Volume load in kg×reps, counting a share of body weight for body weight work. */
/** Projected hard sets per muscle for one week of the program cycle. */
export function weeklyPlanSets(days: readonly ProgramDay[], sessionsPerWeek: number): Record<MuscleGroup, number> {
  const totals = emptyMuscles();
  if (days.length === 0) return totals;
  for (let i = 0; i < sessionsPerWeek; i++) {
    const planned = plannedSets(days[i % days.length]);
    for (const m of Object.keys(totals) as MuscleGroup[]) totals[m] += planned[m];
  }
  return totals;
}

const PUSH_PATTERNS = new Set(['h_push', 'v_push', 'chest_fly', 'elbow_ext', 'lateral_raise']);
const PULL_PATTERNS = new Set(['h_pull', 'v_pull', 'rear_delt', 'elbow_flex']);

/**
 * Upper body push and pull sets in a week of the plan. Keeping pulling at
 * least level with pushing protects the shoulders.
 */
export function pushPullBalance(days: readonly ProgramDay[], sessionsPerWeek: number): { push: number; pull: number } {
  let push = 0;
  let pull = 0;
  if (days.length === 0) return { push, pull };
  for (let i = 0; i < sessionsPerWeek; i++) {
    for (const planned of days[i % days.length].exercises) {
      const exercise = findExercise(planned.exerciseId);
      if (!exercise) continue;
      if (PUSH_PATTERNS.has(exercise.pattern)) push += planned.sets;
      if (PULL_PATTERNS.has(exercise.pattern)) pull += planned.sets;
    }
  }
  return { push, pull };
}

export function sessionLoad(session: WorkoutSession): number {
  let load = 0;
  for (const ex of session.exercises) {
    const exercise = findExercise(ex.exerciseId);
    if (!exercise || exercise.measure === 'time') continue;
    for (const s of ex.sets) {
      load += (s.weight + exercise.bodyweightFactor * session.bodyweightKg) * s.reps;
    }
  }
  return load;
}

/**
 * Acute:chronic workload ratio (Gabbett, 2016): this week's load against the
 * average week of the last four. Above ~1.5 injury risk climbs sharply.
 * Returns null until there are three weeks of history to compare against.
 */
export function acuteChronicRatio(sessions: readonly WorkoutSession[], today: DayKey): number | null {
  const inWindow = sessions.filter((s) => {
    const age = daysBetween(s.dayKey, today);
    return age >= 0 && age < 28;
  });
  const oldest = sessions.reduce<DayKey | null>(
    (min, s) => (min === null || s.dayKey < min ? s.dayKey : min),
    null,
  );
  if (!oldest || daysBetween(oldest, today) < 21) return null;
  const acute = inWindow.filter((s) => daysBetween(s.dayKey, today) < 7).reduce((sum, s) => sum + sessionLoad(s), 0);
  const chronic = inWindow.reduce((sum, s) => sum + sessionLoad(s), 0) / 4;
  if (chronic <= 0) return null;
  return acute / chronic;
}

export type WarningLevel = 'info' | 'caution' | 'danger';

export interface TrainingWarning {
  id: string;
  level: WarningLevel;
  title: string;
  detail: string;
  muscles?: MuscleGroup[];
}

function hoursSinceMuscleHit(
  sessions: readonly WorkoutSession[],
  muscle: MuscleGroup,
  now: number,
  minSets: number,
): number | null {
  let latest: number | null = null;
  for (const session of sessions) {
    let sets = 0;
    for (const ex of session.exercises) {
      const exercise = findExercise(ex.exerciseId);
      if (!exercise || exercise.kind === 'mobility') continue;
      const done = ex.sets.filter((s) => s.reps > 0).length;
      if (exercise.primary.includes(muscle)) sets += done;
      else if (exercise.secondary.includes(muscle)) sets += done * 0.5;
    }
    const end = session.endedAt ?? session.startedAt;
    if (sets >= minSets && (latest === null || end > latest)) latest = end;
  }
  return latest === null ? null : (now - latest) / 3_600_000;
}

function consecutiveTrainingDays(sessions: readonly WorkoutSession[], today: DayKey): number {
  const days = new Set(sessions.filter((s) => s.kind === 'standard').map((s) => s.dayKey));
  let count = 0;
  let day = addDays(today, -1);
  while (days.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

/** Warnings for today's planned session based on recent training. */
export function assessPlan(
  plan: ProgramDay,
  sessions: readonly WorkoutSession[],
  today: DayKey,
  now: number,
): TrainingWarning[] {
  const warnings: TrainingWarning[] = [];
  const planned = plannedSets(plan);
  const pastWeek = weeklySets(sessions, addDays(today, -1), 6);

  const overVolume = (Object.keys(planned) as MuscleGroup[]).filter(
    (m) => planned[m] >= 2 && pastWeek[m] + planned[m] > VOLUME_LANDMARKS[m].mrv,
  );
  if (overVolume.length > 0) {
    const worst = overVolume[0];
    warnings.push({
      id: 'volume_high',
      level: 'caution',
      title: 'Weekly volume is near your recovery limit',
      detail: `${overVolume.map((m) => MUSCLE_LABELS[m]).join(', ')} would reach about ${Math.round(
        pastWeek[worst] + planned[worst],
      )} hard sets this week. Past roughly ${VOLUME_LANDMARKS[worst].mrv} sets most lifters stop gaining and start digging a recovery hole. Dropping a set per exercise keeps the progress.`,
      muscles: overVolume,
    });
  }

  const unrecovered = (Object.keys(planned) as MuscleGroup[]).filter((m) => {
    if (planned[m] < 3) return false;
    const window = LARGE_MUSCLES.includes(m) ? 48 : 24;
    const hours = hoursSinceMuscleHit(sessions, m, now, 6);
    return hours !== null && hours < window;
  });
  if (unrecovered.length > 0) {
    warnings.push({
      id: 'recovery_window',
      level: 'caution',
      title: 'Some muscles are still recovering',
      detail: `${unrecovered.map((m) => MUSCLE_LABELS[m]).join(', ')} took a hard hit within the last two days. Muscle protein synthesis and repair run for 24 to 72 hours, so go lighter on them today or swap to the next day in your plan.`,
      muscles: unrecovered,
    });
  }

  const ratio = acuteChronicRatio(sessions, today);
  if (ratio !== null && ratio > 1.5) {
    warnings.push({
      id: 'load_spike',
      level: 'danger',
      title: 'Training load spike',
      detail: `This week's load is ${ratio.toFixed(1)} times your four-week average. Injury risk rises steeply above 1.5 times, so keep today moderate and build back gradually.`,
    });
  } else if (ratio !== null && ratio > 1.3) {
    warnings.push({
      id: 'load_rising',
      level: 'info',
      title: 'Load is climbing fast',
      detail: `This week is ${ratio.toFixed(1)} times your recent average. That is productive, just avoid stacking a big jump on top.`,
    });
  }

  const streak = consecutiveTrainingDays(sessions, today);
  if (streak >= 6) {
    warnings.push({
      id: 'no_rest',
      level: 'caution',
      title: `${streak} training days in a row`,
      detail: 'Consider a recovery session today. You keep your streak and your joints get a breather.',
    });
  }
  return warnings;
}

/** Live check while logging: flags loads far beyond the lifter's best. */
export function checkLoadJump(
  exercise: Exercise,
  weightKg: number,
  record: ExerciseRecord | undefined,
  unit: WeightUnit = 'kg',
): TrainingWarning | null {
  if (!exercise.externalLoad || !record || record.bestWeight <= 0 || weightKg <= 0) return null;
  const lower = exercise.region === 'lower' || exercise.pattern === 'hinge';
  const limit = lower ? 1.15 : 1.1;
  const jump = weightKg - record.bestWeight;
  if (weightKg <= record.bestWeight * limit || jump < loadIncrement(exercise, unit) * 2) return null;
  const pct = Math.round((weightKg / record.bestWeight - 1) * 100);
  return {
    id: 'load_jump',
    level: 'caution',
    title: `${pct}% above your best`,
    detail: `Big jumps are where strains happen. Warm up with a couple of lighter sets, keep two reps in the tank, and add load in smaller steps.`,
  };
}

/** Average of weigh-ins in the `days` days ending on `day`, or null. */
export function averageWeight(weighIns: readonly WeighIn[], day: DayKey, days = 7): number | null {
  const window = weighIns.filter((w) => {
    const age = daysBetween(w.dayKey, day);
    return age >= 0 && age < days;
  });
  if (window.length === 0) return null;
  return window.reduce((sum, w) => sum + w.kg, 0) / window.length;
}

/** Weekly change of the 7-day average, as a percent of body weight. */
export function weeklyWeightChangePct(weighIns: readonly WeighIn[], today: DayKey): number | null {
  const now = averageWeight(weighIns, today);
  const before = averageWeight(weighIns, addDays(today, -7));
  if (now === null || before === null || before <= 0) return null;
  return ((now - before) / before) * 100;
}

/**
 * Healthy rates: fat loss around 0.5 to 1% of body weight per week preserves
 * muscle (Helms et al., 2014). Lean gain of about 0.25 to 0.5% per week keeps
 * fat gain modest.
 */
export function assessWeightRate(
  direction: 'down' | 'up',
  ratePct: number | null,
): TrainingWarning | null {
  if (ratePct === null) return null;
  if (direction === 'down' && ratePct < -1) {
    return {
      id: 'losing_fast',
      level: 'caution',
      title: `Losing ${Math.abs(ratePct).toFixed(1)}% a week`,
      detail: 'Faster than about 1% per week raises the risk of losing muscle and strength. A slightly smaller calorie deficit keeps more of what you build.',
    };
  }
  if (direction === 'up' && ratePct > 0.75) {
    return {
      id: 'gaining_fast',
      level: 'info',
      title: `Gaining ${ratePct.toFixed(1)}% a week`,
      detail: 'Above roughly 0.5% per week, most of the extra weight is fat rather than muscle. Trim the surplus a little.',
    };
  }
  return null;
}

export interface RecoveryTargets {
  proteinG: [number, number];
  waterMl: number;
  sleepHours: [number, number];
}

/**
 * Daily targets scaled to body weight: protein 1.6 to 2.2 g/kg for muscle gain
 * (Morton et al., 2018), higher in a deficit to protect lean mass, water about
 * 35 ml/kg plus extra on training days, and 7 to 9 hours of sleep.
 */
export function recoveryTargets(bodyweightKg: number, focus: Focus, trainingDay: boolean): RecoveryTargets {
  const protein: Record<Focus, [number, number]> = {
    grow: [1.6, 2.2],
    fit: [1.4, 2.0],
    lean: [1.8, 2.4],
  };
  const [lo, hi] = protein[focus];
  return {
    proteinG: [Math.round(bodyweightKg * lo), Math.round(bodyweightKg * hi)],
    waterMl: Math.round((bodyweightKg * 35 + (trainingDay ? 750 : 0)) / 50) * 50,
    sleepHours: [7, 9],
  };
}

export function goalDirection(kind: GoalKind, start: number, target: number): 'down' | 'up' {
  if (kind !== 'bodyweight') return 'up';
  return target < start ? 'down' : 'up';
}
