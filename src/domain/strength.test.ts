import { getExercise } from './exercises';
import { estimateOneRepMax, formatWeight, roundLoad, suggestNextTarget, suggestStartingLoad } from './strength';
import type { SetLog } from './types';

const set = (weight: number, reps: number): SetLog => ({
  id: `${weight}x${reps}`,
  weight,
  reps,
  startedAt: 0,
  endedAt: 30_000,
});

describe('estimateOneRepMax', () => {
  it('uses Epley and returns the weight itself for singles', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1);
  });

  it('caps the rep count so high-rep sets do not inflate the estimate', () => {
    expect(estimateOneRepMax(50, 30)).toBe(estimateOneRepMax(50, 12));
  });

  it('is zero for unloaded or empty sets', () => {
    expect(estimateOneRepMax(0, 10)).toBe(0);
    expect(estimateOneRepMax(60, 0)).toBe(0);
  });
});

describe('formatting and rounding', () => {
  it('formats kg and lb with trimmed decimals', () => {
    expect(formatWeight(62.5, 'kg')).toBe('62.5 kg');
    expect(formatWeight(60, 'kg')).toBe('60 kg');
    expect(formatWeight(61.235, 'lb')).toBe('135 lb');
  });

  it('never rounds a barbell below the empty bar', () => {
    expect(roundLoad(12, getExercise('bench_press'))).toBe(20);
  });

  it('rounds dumbbells to whole kilos and plates to 2.5 kg', () => {
    expect(roundLoad(13.4, getExercise('db_row'))).toBe(13);
    expect(roundLoad(63.6, getExercise('bench_press'))).toBe(62.5);
  });
});

describe('suggestStartingLoad', () => {
  it('scales with body weight, experience and sex', () => {
    const bench = getExercise('bench_press');
    const novice = suggestStartingLoad(bench, 80, 'beginner', 'male');
    const intermediate = suggestStartingLoad(bench, 80, 'intermediate', 'male');
    const female = suggestStartingLoad(bench, 80, 'beginner', 'female');
    expect(novice).toBe(32.5);
    expect(intermediate!).toBeGreaterThan(novice!);
    expect(female!).toBeLessThan(novice!);
  });

  it('returns 0 for body weight movements', () => {
    expect(suggestStartingLoad(getExercise('push_up'), 80, 'beginner', 'male')).toBe(0);
  });
});

describe('suggestNextTarget (double progression)', () => {
  const bench = getExercise('bench_press');

  it('adds weight once every set reaches the top of the range', () => {
    const next = suggestNextTarget(bench, [set(60, 10), set(60, 10), set(60, 10)], 6, 10);
    expect(next?.weight).toBe(62.5);
    expect(next?.reps).toBe(6);
  });

  it('keeps the weight and asks for one more rep otherwise', () => {
    const next = suggestNextTarget(bench, [set(60, 8), set(60, 7), set(60, 6)], 6, 10);
    expect(next?.weight).toBe(60);
    expect(next?.reps).toBe(9);
  });

  it('backs off about 10% after a session well short of the range', () => {
    const next = suggestNextTarget(bench, [set(60, 4), set(60, 3), set(60, 5)], 6, 10);
    expect(next?.weight).toBe(55);
  });

  it('progresses body weight exercises by reps', () => {
    const next = suggestNextTarget(getExercise('push_up'), [set(0, 12), set(0, 10)], 8, 15);
    expect(next?.weight).toBe(0);
    expect(next?.reps).toBe(13);
  });

  it('returns null without history', () => {
    expect(suggestNextTarget(bench, [], 6, 10)).toBeNull();
  });
});
