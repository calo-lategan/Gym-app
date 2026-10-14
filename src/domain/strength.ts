import type { Exercise, Experience, SetLog, Sex, WeightUnit } from './types';

export const KG_PER_LB = 0.45359237;

export const toDisplayWeight = (kg: number, unit: WeightUnit) => (unit === 'kg' ? kg : kg / KG_PER_LB);
export const fromDisplayWeight = (value: number, unit: WeightUnit) => (unit === 'kg' ? value : value * KG_PER_LB);

/** Display value for a load, rounded to 0.25 kg or 1 lb with trailing zeros trimmed. */
export function displayWeightValue(kg: number, unit: WeightUnit): number {
  const value = toDisplayWeight(kg, unit);
  return unit === 'kg' ? Math.round(value * 4) / 4 : Math.round(value);
}

/** Format a load for display: "62.5 kg", "140 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${Number(displayWeightValue(kg, unit).toFixed(2))} ${unit}`;
}

/**
 * Estimated one-rep max (Epley). Beyond ~12 reps estimates get unreliable, so
 * reps are capped there; a 20-rep set is scored like a 12-rep set.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 12) / 30);
}

/** Smallest sensible jump for an exercise, in kg. */
export function loadIncrement(exercise: Exercise, unit: WeightUnit = 'kg'): number {
  const lower = exercise.region === 'lower' || exercise.pattern === 'hinge';
  if (unit === 'lb') return (lower ? 10 : 5) * KG_PER_LB;
  if (exercise.equipment.includes('dumbbells') || exercise.equipment.includes('kettlebell')) {
    return 2;
  }
  return lower ? 5 : 2.5;
}

/** Round a load to what can actually be put on the bar or picked off the rack. */
export function roundLoad(kg: number, exercise: Exercise, unit: WeightUnit = 'kg'): number {
  if (kg <= 0) return 0;
  const step = unit === 'lb' ? 5 * KG_PER_LB : exercise.equipment.includes('dumbbells') ? 1 : 2.5;
  const rounded = Math.round(kg / step) * step;
  const minimum = exercise.equipment.includes('barbell') && exercise.externalLoad ? 20 : step;
  return Math.max(minimum, Number(rounded.toFixed(3)));
}

/**
 * Conservative starting loads as a fraction of body weight for a beginner.
 * Dumbbell values are per hand. These are deliberately light: the first
 * session is for finding a weight that leaves two or three reps in reserve.
 */
const START_RATIOS: Record<string, number> = {
  back_squat: 0.5,
  front_squat: 0.4,
  deadlift: 0.6,
  romanian_deadlift: 0.4,
  hip_thrust: 0.5,
  bench_press: 0.4,
  incline_bench_press: 0.33,
  overhead_press: 0.25,
  barbell_row: 0.35,
  barbell_curl: 0.15,
  skull_crusher: 0.12,
  leg_press: 0.8,
  hack_squat: 0.4,
  machine_chest_press: 0.3,
  machine_shoulder_press: 0.2,
  machine_row: 0.3,
  lat_pulldown: 0.35,
  seated_cable_row: 0.35,
  cable_pushdown: 0.15,
  cable_curl: 0.12,
  cable_fly: 0.08,
  cable_lateral_raise: 0.04,
  face_pull: 0.12,
  cable_crunch: 0.2,
  leg_curl: 0.25,
  leg_extension: 0.3,
  pec_deck: 0.2,
  machine_calf_raise: 0.5,
  goblet_squat: 0.15,
  kb_goblet_squat: 0.15,
  db_bench_press: 0.12,
  db_incline_press: 0.1,
  db_floor_press: 0.1,
  db_shoulder_press: 0.08,
  db_row: 0.12,
  db_romanian_deadlift: 0.12,
  db_lunge: 0.06,
  bulgarian_split_squat: 0.06,
  db_fly: 0.05,
  lateral_raise: 0.04,
  rear_delt_fly: 0.03,
  db_curl: 0.06,
  hammer_curl: 0.07,
  overhead_db_extension: 0.1,
  db_calf_raise: 0.12,
  kb_swing: 0.2,
  kb_press: 0.08,
  kb_row: 0.12,
  kb_curl: 0.08,
};

const EXPERIENCE_MULTIPLIER: Record<Experience, number> = {
  beginner: 1,
  intermediate: 1.4,
  advanced: 1.8,
};

export function suggestStartingLoad(
  exercise: Exercise,
  bodyweightKg: number,
  experience: Experience,
  sex: Sex,
  unit: WeightUnit = 'kg',
): number | undefined {
  if (!exercise.externalLoad) return 0;
  const ratio = START_RATIOS[exercise.id];
  if (ratio === undefined || bodyweightKg <= 0) return undefined;
  const sexFactor = sex === 'female' ? (exercise.region === 'upper' ? 0.7 : 0.85) : 1;
  return roundLoad(bodyweightKg * ratio * EXPERIENCE_MULTIPLIER[experience] * sexFactor, exercise, unit);
}

export interface TargetSuggestion {
  weight: number;
  /** Rep goal for the first set. */
  reps: number;
  reason: string;
}

/**
 * Double progression: stay at a load until every set reaches the top of the
 * rep range, then add the smallest increment. A session that falls well short
 * of the range drops the load by about 10%.
 */
export function suggestNextTarget(
  exercise: Exercise,
  lastSets: readonly SetLog[],
  repMin: number,
  repMax: number,
  unit: WeightUnit = 'kg',
): TargetSuggestion | null {
  const working = lastSets.filter((s) => s.reps > 0);
  if (working.length === 0) return null;

  if (!exercise.externalLoad) {
    const best = Math.max(...working.map((s) => s.reps));
    const addedLoad = Math.max(...working.map((s) => s.weight));
    if (working.every((s) => s.reps >= repMax) && addedLoad === 0 && exercise.measure === 'reps') {
      return {
        weight: 0,
        reps: Math.min(best + 1, repMax + 5),
        reason: 'You topped the rep range. Add a rep, or slow the lowering phase.',
      };
    }
    return {
      weight: addedLoad,
      reps: Math.min(best + 1, Math.max(repMax, best + 1)),
      reason: 'Beat last time by one rep.',
    };
  }

  const weight = Math.max(...working.map((s) => s.weight));
  const atWeight = working.filter((s) => s.weight === weight);
  if (atWeight.every((s) => s.reps >= repMax)) {
    return {
      weight: roundLoad(weight + loadIncrement(exercise, unit), exercise, unit),
      reps: repMin,
      reason: `You hit ${repMax} reps on every set. Time to add weight.`,
    };
  }
  const short = atWeight.filter((s) => s.reps < repMin).length;
  if (short > atWeight.length / 2 && weight > 0) {
    return {
      weight: roundLoad(weight * 0.9, exercise, unit),
      reps: repMin,
      reason: 'Last session fell short of the range. Back off about 10% and build up again.',
    };
  }
  const bestReps = Math.max(...atWeight.map((s) => s.reps));
  return {
    weight,
    reps: Math.min(repMax, bestReps + 1),
    reason: 'Same weight. Aim for one more rep than last time.',
  };
}
