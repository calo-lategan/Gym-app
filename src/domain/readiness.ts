import { findExercise } from './exercises';
import { MUSCLE_LABELS } from './science';
import { bestSubstitute } from './substitution';
import type { EquipmentId, JointArea, MuscleGroup, PlannedExercise, ProgramDay, ReadinessInput } from './types';

export type ReadinessBand = 'ready' | 'steady' | 'tired' | 'drained';

export interface ReadinessResult {
  score: number;
  band: ReadinessBand;
  headline: string;
  notes: string[];
}

/**
 * Readiness from a short wellness check, adapted from the Hooper index
 * (Hooper & Mackinnon, 1995): sleep, fatigue, stress and soreness are the
 * self-reports that best track how well an athlete is recovering.
 */
export function scoreReadiness(input: ReadinessInput): ReadinessResult {
  const hours = input.sleepHours;
  const hoursScore = hours < 5 ? 0.2 : hours < 6 ? 0.5 : hours < 7 ? 0.75 : hours <= 9 ? 1 : 0.9;
  const sleep = 0.6 * hoursScore + 0.4 * ((clamp15(input.sleepQuality) - 1) / 4);
  const energy = (clamp15(input.energy) - 1) / 4;
  const calm = (5 - clamp15(input.stress)) / 4;
  const worstSoreness = Math.max(0, ...Object.values(input.soreness).map((v) => v ?? 0));
  const soreness = [1, 0.85, 0.6, 0.3][worstSoreness] ?? 0.3;

  const score = Math.round(100 * (0.35 * sleep + 0.3 * energy + 0.15 * calm + 0.2 * soreness));
  const band: ReadinessBand = score >= 70 ? 'ready' : score >= 55 ? 'steady' : score >= 35 ? 'tired' : 'drained';

  const notes: string[] = [];
  if (hours < 6) {
    notes.push('Under six hours of sleep lowers strength and focus. Skip max attempts today.');
  }
  if (input.pain.length > 0) {
    notes.push(
      'Pain is a signal, not a challenge. Exercises loading that joint are taken out today. If it lasts more than a few days, see a physio or doctor.',
    );
  }

  const headline: Record<ReadinessBand, string> = {
    ready: score >= 88 ? 'Primed. A great day to chase a record.' : 'Ready to train as planned.',
    steady: 'Good to go, with a little less volume.',
    tired: 'Running low. Train lighter today and still bank the session.',
    drained: 'Your body is asking for recovery. A recovery session keeps your streak alive.',
  };
  return { score, band, headline: headline[band], notes };
}

const clamp15 = (v: number) => Math.min(5, Math.max(1, v));

export interface AdjustedDay {
  day: ProgramDay;
  changes: string[];
  /** Fraction to multiply suggested loads by (1 = unchanged). */
  loadFactor: number;
  /** Extra rest added to every exercise, in seconds. */
  extraRestSec: number;
}

/**
 * Small, explainable changes to today's plan that let the lifter still train:
 * trim sets when readiness dips, lighten loads when it drops further, ease off
 * sore muscles and take out exercises that load a painful joint.
 */
export function adjustPlanForReadiness(
  day: ProgramDay,
  input: ReadinessInput,
  result: ReadinessResult,
  equipment: readonly EquipmentId[],
): AdjustedDay {
  const changes: string[] = [];
  let loadFactor = 1;
  let extraRestSec = 0;
  const used = new Set(day.exercises.map((e) => e.exerciseId));
  const exercises: PlannedExercise[] = [];

  for (const planned of day.exercises) {
    const exercise = findExercise(planned.exerciseId);
    if (!exercise) continue;
    let next = { ...planned };

    const painful = exercise.joints.filter((j) => input.pain.includes(j));
    if (painful.length > 0) {
      const swap = findJointFriendly(planned.exerciseId, input.pain, equipment, used);
      if (swap) {
        used.add(swap);
        changes.push(`Swapped ${exercise.name} for ${findExercise(swap)!.name} to spare your ${jointLabel(painful[0])}.`);
        next = { ...next, exerciseId: swap };
      } else {
        changes.push(`Skipped ${exercise.name} to spare your ${jointLabel(painful[0])}.`);
        continue;
      }
    }

    const sore = exercise.primary.filter((m) => (input.soreness[m] ?? 0) >= 2);
    if (sore.length > 0) {
      const severe = sore.some((m) => input.soreness[m] === 3);
      next.sets = Math.max(severe ? 1 : 2, next.sets - (severe ? 2 : 1));
      changes.push(
        `${severe ? 'Halved' : 'Trimmed'} ${exercise.name} because your ${sore.map((m) => MUSCLE_LABELS[m as MuscleGroup].toLowerCase()).join(' and ')} ${sore.length > 1 ? 'are' : 'is'} sore.`,
      );
    }
    exercises.push(next);
  }

  if (result.band === 'steady') {
    let trimmed = 0;
    for (const e of exercises) {
      const exercise = findExercise(e.exerciseId);
      if (exercise && exercise.kind !== 'compound' && e.sets >= 3) {
        e.sets -= 1;
        trimmed++;
      }
    }
    if (trimmed > 0) changes.push(`One set less on ${trimmed} accessory exercise${trimmed > 1 ? 's' : ''}.`);
  }
  if (result.band === 'tired' || result.band === 'drained') {
    for (const e of exercises) e.sets = Math.max(2, e.sets - 1);
    loadFactor = 0.9;
    extraRestSec = 30;
    changes.push('One set less per exercise, loads about 10% lighter, 30 seconds more rest. Stop each set with about three reps left.');
  }
  return { day: { ...day, exercises }, changes, loadFactor, extraRestSec };
}

function findJointFriendly(exerciseId: string, pain: readonly JointArea[], equipment: readonly EquipmentId[], used: Set<string>): string | null {
  const exclude = [...used];
  for (let i = 0; i < 6; i++) {
    const candidate = bestSubstitute(exerciseId, equipment, exclude);
    if (!candidate) return null;
    if (!candidate.joints.some((j) => pain.includes(j)) && candidate.id !== exerciseId) return candidate.id;
    exclude.push(candidate.id);
  }
  return null;
}

const JOINT_LABELS: Record<JointArea, string> = {
  shoulder: 'shoulder',
  elbow: 'elbow',
  wrist: 'wrist',
  lower_back: 'lower back',
  hip: 'hip',
  knee: 'knee',
  ankle: 'ankle',
};

export const jointLabel = (j: JointArea) => JOINT_LABELS[j];
