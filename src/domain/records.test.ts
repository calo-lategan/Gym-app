import { getExercise } from './exercises';
import { applySet, dedupePrs, detectPrs, prSummary, prsForNewSet, type ExerciseRecord } from './records';
import type { SetLog } from './types';

let n = 0;
const set = (weight: number, reps: number, seconds = 30, untimed = false): SetLog => ({
  id: `s${n++}`,
  weight,
  reps,
  startedAt: 1_000_000,
  endedAt: 1_000_000 + seconds * 1000,
  untimed,
});

const bench = getExercise('bench_press');
const pushUp = getExercise('push_up');
const plank = getExercise('plank');

function recordFrom(sets: SetLog[], exercise = bench): ExerciseRecord {
  return sets.reduce<ExerciseRecord | undefined>((r, s) => applySet(r, s, exercise, '2026-10-01'), undefined)!;
}

describe('detectPrs', () => {
  it('does not award PRs for the very first set of an exercise', () => {
    expect(detectPrs(undefined, set(60, 8), bench)).toEqual([]);
  });

  it('awards weight and strength PRs for a heavier set', () => {
    const record = recordFrom([set(60, 8)]);
    const kinds = detectPrs(record, set(65, 6), bench).map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['weight', 'e1rm']));
  });

  it('awards a rep PR for more reps at the same load', () => {
    const record = recordFrom([set(60, 8)]);
    const events = detectPrs(record, set(60, 9), bench);
    expect(events.map((e) => e.kind)).toContain('reps');
  });

  it('does not count more reps at a lighter load as a rep PR when heavier was already done for more', () => {
    const record = recordFrom([set(70, 10)]);
    expect(detectPrs(record, set(60, 9), bench).map((e) => e.kind)).not.toContain('reps');
  });

  it('awards rep PRs for body weight work', () => {
    const record = recordFrom([set(0, 15)], pushUp);
    expect(detectPrs(record, set(0, 18), pushUp).map((e) => e.kind)).toContain('reps');
    expect(detectPrs(record, set(0, 18), pushUp).map((e) => e.kind)).not.toContain('weight');
  });

  it('awards speed PRs only for clearly faster, plausible, timed sets', () => {
    const record = recordFrom([set(0, 10, 25)], pushUp);
    expect(detectPrs(record, set(0, 10, 21), pushUp).map((e) => e.kind)).toContain('speed');
    // Barely faster: timer noise.
    expect(detectPrs(record, set(0, 10, 24.5), pushUp).map((e) => e.kind)).not.toContain('speed');
    // Faster than a second per rep: not a real set.
    expect(detectPrs(record, set(0, 10, 8), pushUp).map((e) => e.kind)).not.toContain('speed');
    // Logged without the timer.
    expect(detectPrs(record, set(0, 10, 20, true), pushUp).map((e) => e.kind)).not.toContain('speed');
  });

  it('awards hold PRs for timed exercises', () => {
    const record = recordFrom([set(0, 45)], plank);
    expect(detectPrs(record, set(0, 50), plank).map((e) => e.kind)).toEqual(['hold']);
  });
});

describe('prsForNewSet', () => {
  it('does not re-award a PR already set earlier in the same session', () => {
    const pre = recordFrom([set(60, 8)]);
    const first = set(62.5, 8);
    const second = set(62.5, 8);
    expect(prsForNewSet(pre, [], first, bench, '2026-10-02').length).toBeGreaterThan(0);
    expect(prsForNewSet(pre, [first], second, bench, '2026-10-02')).toEqual([]);
  });
});

describe('dedupePrs', () => {
  it('keeps the strongest event of each kind per exercise', () => {
    const pre = recordFrom([set(60, 8)]);
    const events = [set(62.5, 6), set(65, 5)].flatMap((s) => detectPrs(pre, s, bench));
    const weight = dedupePrs(events).filter((e) => e.kind === 'weight');
    expect(weight).toHaveLength(1);
    expect(weight[0].value).toBe(65);
  });
});

describe('prSummary', () => {
  const base = { exerciseId: 'bench_press', setId: 'x', weight: 80, reps: 5, previous: 0 };
  it('describes each record kind in the lifter\'s unit', () => {
    expect(prSummary({ ...base, kind: 'weight', value: 82.5, previous: 80 }, 'kg')).toBe('82.5 kg for 5 reps');
    expect(prSummary({ ...base, kind: 'reps', value: 8, previous: 6 }, 'kg')).toBe('8 reps at 80 kg, up from 6');
    expect(prSummary({ ...base, kind: 'reps', weight: 0, value: 21, previous: 18 }, 'kg')).toBe('21 reps, up from 18');
    expect(prSummary({ ...base, kind: 'hold', value: 75, previous: 60 }, 'kg')).toBe('75 s hold, up from 60 s');
    expect(prSummary({ ...base, kind: 'speed', value: 18.4, previous: 22.1 }, 'kg')).toBe('5 reps in 18 s, down from 22 s');
    expect(prSummary({ ...base, kind: 'e1rm', value: 100, previous: 95 }, 'lb')).toBe('Estimated max 220 lb, up from 209 lb');
  });
});
