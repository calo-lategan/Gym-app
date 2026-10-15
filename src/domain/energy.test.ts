import { addDays } from './dates';
import {
  dailyBurn,
  gymIntensity,
  gymKcal,
  intakePlan,
  restingKcal,
  runningKcal,
  strideM,
  walkingKcal,
  weightSlopeKgPerDay,
  type BodyStats,
  type IntakeInput,
} from './energy';
import type { WeighIn, WorkoutSession } from './types';

const MAN: BodyStats = { weightKg: 80, heightCm: 180, age: 30, sex: 'male' };
const WOMAN: BodyStats = { weightKg: 60, heightCm: 165, age: 25, sex: 'female' };
const TODAY = '2026-10-15';

function session(minutes: number, sets: number, kind: WorkoutSession['kind'] = 'standard'): WorkoutSession {
  const startedAt = Date.UTC(2026, 9, 15, 18);
  return {
    id: 's',
    dayKey: TODAY,
    programDayId: null,
    title: 'Push',
    location: 'gym',
    kind,
    scheduled: true,
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    bodyweightKg: 80,
    exercises: [
      {
        slotId: 'a',
        exerciseId: 'bench_press',
        targetSets: sets,
        repMin: 8,
        repMax: 12,
        restSec: 90,
        sets: Array.from({ length: sets }, (_, i) => ({ id: `${i}`, reps: 8, weight: 60, startedAt, endedAt: startedAt })),
      },
    ],
  };
}

describe('resting burn', () => {
  it('follows Mifflin-St Jeor', () => {
    expect(restingKcal(MAN)).toEqual({ kcal: 1780, estimated: false });
    expect(restingKcal(WOMAN).kcal).toBeCloseTo(1345.25);
  });

  it('flags estimates when height or age is missing', () => {
    expect(restingKcal({ ...MAN, heightCm: null }).estimated).toBe(true);
    expect(restingKcal({ ...MAN, age: null }).estimated).toBe(true);
  });
});

describe('activity', () => {
  it('prices walking and running per kg per km', () => {
    expect(walkingKcal(10, 70)).toBeCloseTo(350);
    expect(runningKcal(5, 80)).toBeCloseTo(400);
  });

  it('prices lifting above resting and caps forgotten sessions', () => {
    expect(gymKcal(60, 80, 'moderate')).toBeCloseTo(320);
    expect(gymKcal(400, 80, 'hard')).toBeCloseTo(1000);
  });

  it('reads intensity from session density', () => {
    expect(gymIntensity(session(60, 20))).toBe('moderate');
    expect(gymIntensity(session(50, 30))).toBe('hard');
    expect(gymIntensity(session(40, 30, 'recovery'))).toBe('recovery');
  });

  it('estimates stride from height', () => {
    expect(strideM(MAN)).toBeCloseTo(0.747);
  });
});

describe('daily burn', () => {
  it('adds resting, daily living and walking from steps', () => {
    const day = dailyBurn(MAN, { steps: 10_000, runs: [], gym: [] });
    expect(day.resting).toBe(1780);
    expect(day.living).toBe(267);
    expect(day.walkingKm).toBe(7.5);
    expect(day.walking).toBe(299);
    expect(day.total).toBe(2346);
  });

  it('takes runs out of walking so nothing is counted twice', () => {
    const tracked = dailyBurn(MAN, { steps: 12_000, distanceKm: 8, runs: [{ km: 5, minutes: 28 }], gym: [] });
    expect(tracked.walking).toBe(120);
    expect(tracked.running).toBe(400);
    const fromSteps = dailyBurn(MAN, { steps: 10_000, runs: [{ km: 5, minutes: 28 }], gym: [] });
    expect(fromSteps.walking).toBe(165);
  });

  it('includes gym sessions', () => {
    const day = dailyBurn(MAN, { steps: 0, runs: [], gym: [{ minutes: 60, intensity: 'moderate' }] });
    expect(day.gym).toBe(320);
  });
});

describe('weight trend', () => {
  const series = (days: number, perDay: number): WeighIn[] =>
    Array.from({ length: days }, (_, i) => ({ dayKey: addDays(TODAY, -i), kg: 80 - perDay * (days - 1 - i), at: 0 }));

  it('fits the slope by least squares', () => {
    expect(weightSlopeKgPerDay(series(14, 0.1), TODAY)).toBeCloseTo(-0.1);
  });

  it('needs enough weigh-ins over enough days', () => {
    expect(weightSlopeKgPerDay(series(3, 0.1), TODAY)).toBeNull();
    expect(weightSlopeKgPerDay(series(6, 0.1), TODAY)).toBeNull();
  });
});

describe('intake plan', () => {
  const base: IntakeInput = { focus: 'lean', body: MAN, recentBurn: [2500, 2500, 2500], weeklyChangePct: null, trainingDay: true };

  it('sets a deficit for fat loss and asks for weigh-ins', () => {
    const plan = intakePlan(base);
    expect(plan.maintenance).toBe(2500);
    expect(plan.target).toBe(2000);
    expect(plan.proteinG).toEqual([144, 192]);
    expect(plan.notes[0]).toMatch(/Weigh in/);
  });

  it('eases the deficit when weight drops faster than the muscle-sparing pace', () => {
    expect(intakePlan({ ...base, weeklyChangePct: -1.5 }).target).toBe(2150);
  });

  it('trims the surplus when gaining too fast', () => {
    expect(intakePlan({ ...base, focus: 'grow', weeklyChangePct: 1 }).target).toBe(2600);
  });

  it('halves the deficit on under-recovered days', () => {
    expect(intakePlan({ ...base, readiness: 'drained' }).target).toBe(2250);
  });

  it('never goes below a safe floor', () => {
    const plan = intakePlan({ ...base, body: WOMAN, recentBurn: [1500] });
    expect(plan.target).toBe(1350);
  });

  it('calibrates maintenance from logged food and the weight trend', () => {
    const plan = intakePlan({
      ...base,
      recentBurn: Array(21).fill(2400),
      recentIntake: Array(21).fill(2200),
      slopeKgPerDay: -0.05,
      weeklyChangePct: -1.5,
    });
    expect(plan.calibrated).toBe(true);
    expect(plan.maintenance).toBe(2540);
    expect(plan.target).toBe(2030);
  });
});
