import { daysBetween } from './dates';
import type { ReadinessBand } from './readiness';
import { recoveryTargets } from './science';
import type { DayKey, Focus, Sex, WeighIn, WorkoutSession } from './types';

/**
 * Energy model: what the body burns in a day and how much to eat for the goal.
 * Every figure is an estimate; the intake target calibrates itself from the
 * scale and, when food is logged, from the user's own data.
 */

/** Energy from one litre of oxygen, the standard indirect calorimetry conversion. */
const KCAL_PER_LITRE_O2 = 5;
/** ACSM metabolic equations: net oxygen cost on the flat, ml per kg per metre. */
const WALK_O2_ML_PER_KG_M = 0.1;
const RUN_O2_ML_PER_KG_M = 0.2;
/** Food digestion and moving about without walking, as a share of resting burn. */
const DAILY_LIVING_SHARE = 0.15;
/** Running strides are roughly one and a half walking strides. */
const RUN_STRIDE_FACTOR = 1.5;
/** Longest gym session the model believes, so a forgotten end button cannot inflate the burn. */
const MAX_GYM_MINUTES = 150;
/** Energy in a kilogram of body mass change, mixed fat and lean tissue (Hall, 2008). */
const KCAL_PER_KG = 7700;

const DEFAULT_HEIGHT_CM: Record<Sex, number> = { male: 176, female: 163, unspecified: 170 };
const DEFAULT_AGE = 30;

export interface BodyStats {
  weightKg: number;
  heightCm: number | null;
  age: number | null;
  sex: Sex;
}

export type GymIntensity = 'recovery' | 'moderate' | 'hard';

/** Resistance training METs from the Compendium of Physical Activities. */
export const GYM_MET: Record<GymIntensity, number> = { recovery: 3.5, moderate: 5, hard: 6 };

export interface DayActivity {
  steps: number;
  /** Total distance moved in km when a tracker reports it, runs included. */
  distanceKm?: number | null;
  runs: { km: number; minutes: number }[];
  gym: { minutes: number; intensity: GymIntensity }[];
}

export interface EnergyBreakdown {
  resting: number;
  living: number;
  walking: number;
  running: number;
  gym: number;
  total: number;
  walkingKm: number;
  /** True when height or age is missing and defaults stood in. */
  estimated: boolean;
}

export function ageFrom(birthYear: number | null, today: Date): number | null {
  return birthYear ? Math.max(0, today.getFullYear() - birthYear) : null;
}

/** Resting burn by Mifflin-St Jeor (1990), the most accurate common equation for adults. */
export function restingKcal(body: BodyStats): { kcal: number; estimated: boolean } {
  const height = body.heightCm ?? DEFAULT_HEIGHT_CM[body.sex];
  const age = body.age ?? DEFAULT_AGE;
  const sexTerm = body.sex === 'male' ? 5 : body.sex === 'female' ? -161 : -78;
  return { kcal: 10 * body.weightKg + 6.25 * height - 5 * age + sexTerm, estimated: body.heightCm === null || body.age === null };
}

/** Walking stride is about 41% of height. */
export function strideM(body: BodyStats): number {
  const height = body.heightCm ?? DEFAULT_HEIGHT_CM[body.sex];
  return (height * (body.sex === 'female' ? 0.413 : 0.415)) / 100;
}

/** Calories above resting for walking: about 0.5 kcal per kg per km. */
export function walkingKcal(km: number, weightKg: number): number {
  return ((WALK_O2_ML_PER_KG_M * km * 1000 * weightKg) / 1000) * KCAL_PER_LITRE_O2;
}

/** Calories above resting for running: about 1 kcal per kg per km at any pace. */
export function runningKcal(km: number, weightKg: number): number {
  return ((RUN_O2_ML_PER_KG_M * km * 1000 * weightKg) / 1000) * KCAL_PER_LITRE_O2;
}

/** Calories above resting for lifting; one MET is the resting rate already counted. */
export function gymKcal(minutes: number, weightKg: number, intensity: GymIntensity): number {
  const capped = Math.min(Math.max(0, minutes), MAX_GYM_MINUTES);
  return ((GYM_MET[intensity] - 1) * weightKg * capped) / 60;
}

export function sessionMinutes(session: WorkoutSession): number {
  if (!session.endedAt) return 0;
  return Math.min(MAX_GYM_MINUTES, Math.max(0, (session.endedAt - session.startedAt) / 60_000));
}

/** Dense sessions with short rests burn more per minute than slow, heavy ones. */
export function gymIntensity(session: WorkoutSession): GymIntensity {
  if (session.kind === 'recovery') return 'recovery';
  const minutes = sessionMinutes(session);
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  return minutes > 0 && sets / minutes >= 0.45 ? 'hard' : 'moderate';
}

export function dailyBurn(body: BodyStats, day: DayActivity): EnergyBreakdown {
  const rest = restingKcal(body);
  const runKm = day.runs.reduce((sum, r) => sum + r.km, 0);
  const stride = strideM(body);
  const runSteps = (runKm * 1000) / (stride * RUN_STRIDE_FACTOR);
  const walkingKm = day.distanceKm != null ? Math.max(0, day.distanceKm - runKm) : (Math.max(0, day.steps - runSteps) * stride) / 1000;
  const resting = rest.kcal;
  const living = resting * DAILY_LIVING_SHARE;
  const walking = walkingKcal(walkingKm, body.weightKg);
  const running = runningKcal(runKm, body.weightKg);
  const gym = day.gym.reduce((sum, g) => sum + gymKcal(g.minutes, body.weightKg, g.intensity), 0);
  return {
    resting: Math.round(resting),
    living: Math.round(living),
    walking: Math.round(walking),
    running: Math.round(running),
    gym: Math.round(gym),
    total: Math.round(resting + living + walking + running + gym),
    walkingKm: Math.round(walkingKm * 10) / 10,
    estimated: rest.estimated,
  };
}

/** Body weight trend in kg per day, by least squares over the window, or null. */
export function weightSlopeKgPerDay(weighIns: readonly WeighIn[], today: DayKey, days = 28): number | null {
  const points = weighIns.map((w) => ({ x: -daysBetween(w.dayKey, today), y: w.kg })).filter((p) => p.x <= 0 && p.x > -days);
  if (points.length < 4) return null;
  const span = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
  if (span < 10) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  const num = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  return den === 0 ? null : num / den;
}

export const GOAL_FACTOR: Record<Focus, number> = { grow: 1.1, fit: 1, lean: 0.8 };
/** Healthy weekly pace as % of body weight: lean gain, maintenance, fat loss that spares muscle. */
export const GOAL_PACE_PCT: Record<Focus, [number, number]> = { grow: [0.1, 0.5], fit: [-0.25, 0.25], lean: [-1, -0.4] };
const PACE_STEP_KCAL = 150;
/** Lowest daily target the app suggests without medical supervision. */
const FLOOR_KCAL: Record<Sex, number> = { male: 1500, female: 1200, unspecified: 1350 };
const MIN_LOGGED_DAYS = 14;

export interface IntakeInput {
  focus: Focus;
  body: BodyStats;
  /** Estimated burn for recent full days, oldest first. */
  recentBurn: number[];
  /** Food logged on those same days, null where nothing was logged. */
  recentIntake?: (number | null)[];
  /** Weekly change of the 7-day average weight as % of body weight, or null. */
  weeklyChangePct: number | null;
  /** Body weight trend in kg per day over the same window, or null. */
  slopeKgPerDay?: number | null;
  readiness?: ReadinessBand | null;
  trainingDay: boolean;
}

export interface IntakePlan {
  maintenance: number;
  target: number;
  proteinG: [number, number];
  /** True once logged food and weigh-ins have calibrated maintenance. */
  calibrated: boolean;
  notes: string[];
}

const round10 = (v: number) => Math.round(v / 10) * 10;

export function intakePlan(input: IntakeInput): IntakePlan {
  const { focus, body } = input;
  const notes: string[] = [];
  const burns = input.recentBurn.filter((b) => b > 0);
  const modelMaintenance = burns.length ? burns.reduce((s, b) => s + b, 0) / burns.length : restingKcal(body).kcal * 1.4;

  // With two weeks of food logs and a weight trend, energy balance reveals the real burn:
  // what was eaten, minus what the scale says was stored.
  const logged = (input.recentIntake ?? []).filter((v): v is number => v !== null && v > 0);
  let maintenance = modelMaintenance;
  let calibrated = false;
  if (logged.length >= MIN_LOGGED_DAYS && input.slopeKgPerDay != null) {
    const eaten = logged.reduce((s, v) => s + v, 0) / logged.length;
    const empirical = eaten - input.slopeKgPerDay * KCAL_PER_KG;
    const weight = Math.min(0.8, logged.length / 28);
    maintenance = (1 - weight) * modelMaintenance + weight * empirical;
    calibrated = true;
    notes.push(`Calibrated from your own logs: you burn about ${round10(empirical)} kcal a day.`);
  }

  let target = maintenance * GOAL_FACTOR[focus];
  const [low, high] = GOAL_PACE_PCT[focus];
  const pace = input.weeklyChangePct;
  if (pace === null) {
    notes.push('Weigh in a few times a week and the target tunes itself to your progress.');
  } else if (!calibrated && pace < low) {
    target += PACE_STEP_KCAL;
    notes.push(
      focus === 'lean'
        ? `Losing ${Math.abs(pace).toFixed(1)}% a week is faster than the muscle-sparing pace, so the target is up ${PACE_STEP_KCAL} kcal.`
        : `Your weight is trending below the plan, so the target is up ${PACE_STEP_KCAL} kcal.`,
    );
  } else if (!calibrated && pace > high) {
    target -= PACE_STEP_KCAL;
    notes.push(
      focus === 'grow'
        ? `Gaining ${pace.toFixed(1)}% a week adds more fat than muscle, so the target is down ${PACE_STEP_KCAL} kcal.`
        : `Your weight is trending above the plan, so the target is down ${PACE_STEP_KCAL} kcal.`,
    );
  } else if (pace >= low && pace <= high) {
    notes.push('Your weight is moving at a good pace for your goal.');
  }

  if ((input.readiness === 'tired' || input.readiness === 'drained') && target < maintenance) {
    target = (target + maintenance) / 2;
    notes.push('You are under-recovered today, so the deficit is halved. Food is part of recovery.');
  }

  const floor = Math.max(FLOOR_KCAL[body.sex], restingKcal(body).kcal);
  if (target < floor) {
    target = floor;
    notes.push('The target stops at a safe minimum. Going lower risks muscle, mood and health.');
  }

  return {
    maintenance: round10(maintenance),
    target: round10(target),
    proteinG: recoveryTargets(body.weightKg, focus, input.trainingDay).proteinG,
    calibrated,
    notes,
  };
}
