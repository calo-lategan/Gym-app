import { EXERCISES, getExercise, isAvailable } from './exercises';
import type { EquipmentId, Exercise, Pattern } from './types';

/** Patterns that can stand in for each other when nothing in the same pattern fits. */
const RELATED_PATTERNS: Partial<Record<Pattern, Pattern[]>> = {
  squat: ['lunge', 'knee_ext'],
  lunge: ['squat'],
  hinge: ['hip_ext', 'knee_flex'],
  hip_ext: ['hinge'],
  knee_flex: ['hinge'],
  knee_ext: ['squat', 'lunge'],
  h_push: ['chest_fly', 'v_push'],
  chest_fly: ['h_push'],
  v_push: ['h_push', 'lateral_raise'],
  h_pull: ['v_pull', 'rear_delt'],
  v_pull: ['h_pull'],
  lateral_raise: ['v_push', 'rear_delt'],
  rear_delt: ['h_pull', 'lateral_raise'],
  elbow_flex: ['v_pull', 'h_pull'],
  elbow_ext: ['h_push'],
};

export interface Alternative {
  exercise: Exercise;
  /** 0..1 similarity to the original exercise. */
  score: number;
  reason: string;
}

function overlap<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const shared = a.filter((x) => b.includes(x)).length;
  return shared / Math.max(a.length, b.length);
}

function similarity(original: Exercise, candidate: Exercise): number {
  let score = 0;
  if (candidate.pattern === original.pattern) score += 0.5;
  else if (RELATED_PATTERNS[original.pattern]?.includes(candidate.pattern)) score += 0.2;
  score += 0.3 * overlap(original.primary, candidate.primary);
  score += 0.1 * overlap(original.secondary, candidate.secondary);
  if (candidate.kind === original.kind) score += 0.1;
  return Math.min(1, score);
}

/**
 * Alternatives for an exercise that work with the given equipment, best match
 * first. Used both for "I don't have this equipment" swaps and for building
 * home versions of a gym day.
 */
export function findAlternatives(
  exerciseId: string,
  equipment: readonly EquipmentId[],
  options: { exclude?: readonly string[]; limit?: number } = {},
): Alternative[] {
  const original = getExercise(exerciseId);
  const exclude = new Set([exerciseId, ...(options.exclude ?? [])]);
  const related = RELATED_PATTERNS[original.pattern] ?? [];

  return EXERCISES.filter(
    (candidate) =>
      !exclude.has(candidate.id) &&
      candidate.kind !== 'mobility' &&
      (candidate.pattern === original.pattern || related.includes(candidate.pattern)) &&
      isAvailable(candidate, equipment) &&
      candidate.measure === original.measure,
  )
    .map((candidate) => ({
      exercise: candidate,
      score: similarity(original, candidate),
      reason:
        candidate.pattern === original.pattern
          ? `Same movement, ${describeEquipment(candidate.equipment)}`
          : `Hits the same muscles, ${describeEquipment(candidate.equipment)}`,
    }))
    .sort((a, b) => b.score - a.score || a.exercise.skill - b.exercise.skill)
    .slice(0, options.limit ?? 8);
}

/** Best single substitute, or null when nothing fits the equipment. */
export function bestSubstitute(
  exerciseId: string,
  equipment: readonly EquipmentId[],
  exclude: readonly string[] = [],
): Exercise | null {
  const original = getExercise(exerciseId);
  if (isAvailable(original, equipment) && !exclude.includes(exerciseId)) return original;
  return findAlternatives(exerciseId, equipment, { exclude, limit: 1 })[0]?.exercise ?? null;
}

export function describeEquipment(equipment: readonly EquipmentId[]): string {
  if (equipment.length === 0) return 'no equipment';
  return equipment.map((e) => EQUIPMENT_LABELS[e].toLowerCase()).join(' and ');
}

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  barbell: 'Barbell',
  rack: 'Squat rack',
  bench: 'Bench',
  dumbbells: 'Dumbbells',
  kettlebell: 'Kettlebell',
  cable: 'Cable station',
  machines: 'Machines',
  pullup_bar: 'Pull-up bar',
  dip_bars: 'Dip bars',
  bands: 'Resistance bands',
  cardio: 'Rower or bike',
};

export const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as EquipmentId[];
