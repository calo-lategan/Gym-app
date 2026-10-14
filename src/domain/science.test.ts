import { addDays } from './dates';
import { getExercise } from './exercises';
import { applySet } from './records';
import { adjustPlanForReadiness, scoreReadiness } from './readiness';
import {
  acuteChronicRatio,
  assessPlan,
  assessWeightRate,
  checkLoadJump,
  pushPullBalance,
  recoveryTargets,
  weeklyPlanSets,
  weeklySets,
  weeklyWeightChangePct,
} from './science';
import type { ProgramDay, ReadinessInput, SessionExercise, WeighIn, WorkoutSession } from './types';

const TODAY = '2026-10-13';
const NOW = new Date(2026, 9, 13, 18, 0).getTime();

function session(dayKey: string, exercises: [string, number, number, number][], hoursAgo?: number): WorkoutSession {
  const end = hoursAgo === undefined ? new Date(`${dayKey}T19:00:00`).getTime() : NOW - hoursAgo * 3_600_000;
  return {
    id: `${dayKey}-${Math.random()}`,
    dayKey,
    programDayId: null,
    title: 'Test',
    location: 'gym',
    kind: 'standard',
    scheduled: true,
    startedAt: end - 3_600_000,
    endedAt: end,
    bodyweightKg: 80,
    exercises: exercises.map(
      ([exerciseId, sets, weight, reps], i): SessionExercise => ({
        slotId: `s${i}`,
        exerciseId,
        targetSets: sets,
        repMin: 8,
        repMax: 12,
        restSec: 90,
        sets: Array.from({ length: sets }, (_, k) => ({
          id: `${i}-${k}`,
          weight,
          reps,
          startedAt: end - 60_000,
          endedAt: end - 30_000,
        })),
      }),
    ),
  };
}

const chestDay: ProgramDay = {
  id: 'push',
  name: 'Push',
  label: 'Push',
  exercises: [
    { id: 'a', exerciseId: 'bench_press', sets: 4, repMin: 6, repMax: 10, restSec: 120 },
    { id: 'b', exerciseId: 'db_incline_press', sets: 4, repMin: 8, repMax: 12, restSec: 90 },
    { id: 'c', exerciseId: 'cable_fly', sets: 4, repMin: 10, repMax: 15, restSec: 60 },
  ],
};

describe('weeklySets', () => {
  it('counts primary muscles fully and secondary muscles as half sets', () => {
    const totals = weeklySets([session(TODAY, [['bench_press', 4, 60, 8]])], TODAY);
    expect(totals.chest).toBe(4);
    expect(totals.triceps).toBe(2);
    expect(totals.quads).toBe(0);
  });

  it('ignores sessions outside the window', () => {
    const totals = weeklySets([session(addDays(TODAY, -8), [['bench_press', 4, 60, 8]])], TODAY);
    expect(totals.chest).toBe(0);
  });
});

describe('assessPlan', () => {
  it('warns when weekly volume for a muscle would pass its recovery limit', () => {
    const history = [
      session(addDays(TODAY, -3), [['bench_press', 5, 60, 8], ['cable_fly', 5, 20, 12]]),
      session(addDays(TODAY, -5), [['db_bench_press', 5, 24, 10]]),
    ];
    const ids = assessPlan(chestDay, history, TODAY, NOW).map((w) => w.id);
    expect(ids).toContain('volume_high');
  });

  it('warns when a large muscle was hit hard within 48 hours', () => {
    const history = [session(addDays(TODAY, -1), [['bench_press', 6, 60, 8]], 24)];
    const warning = assessPlan(chestDay, history, TODAY, NOW).find((w) => w.id === 'recovery_window');
    expect(warning?.muscles).toContain('chest');
  });

  it('stays quiet for a sensible week', () => {
    const history = [session(addDays(TODAY, -4), [['back_squat', 4, 80, 8]])];
    expect(assessPlan(chestDay, history, TODAY, NOW)).toEqual([]);
  });

  it('flags six or more training days in a row', () => {
    const history = [1, 2, 3, 4, 5, 6].map((d) => session(addDays(TODAY, -d), [['plank', 3, 0, 45]]));
    expect(assessPlan(chestDay, history, TODAY, NOW).map((w) => w.id)).toContain('no_rest');
  });
});

describe('acuteChronicRatio', () => {
  it('is null until three weeks of history exist', () => {
    expect(acuteChronicRatio([session(addDays(TODAY, -3), [['bench_press', 3, 60, 8]])], TODAY)).toBeNull();
  });

  it('detects a spike when this week dwarfs the previous ones', () => {
    const history = [
      session(addDays(TODAY, -25), [['bench_press', 3, 50, 8]]),
      session(addDays(TODAY, -18), [['bench_press', 3, 50, 8]]),
      session(addDays(TODAY, -11), [['bench_press', 3, 50, 8]]),
      session(addDays(TODAY, -2), [['bench_press', 10, 60, 10]]),
      session(addDays(TODAY, -1), [['bench_press', 10, 60, 10]]),
    ];
    const ratio = acuteChronicRatio(history, TODAY)!;
    expect(ratio).toBeGreaterThan(1.5);
    expect(assessPlan(chestDay, history, TODAY, NOW).map((w) => w.id)).toContain('load_spike');
  });
});

describe('checkLoadJump', () => {
  const bench = getExercise('bench_press');
  const record = applySet(undefined, { id: 'x', weight: 60, reps: 8, startedAt: 0, endedAt: 1 }, bench, TODAY);

  it('flags a jump well beyond the best lift', () => {
    expect(checkLoadJump(bench, 72.5, record)?.id).toBe('load_jump');
  });

  it('allows normal progression', () => {
    expect(checkLoadJump(bench, 62.5, record)).toBeNull();
  });
});

describe('body weight trends', () => {
  const weighIns = (start: number, perDay: number): WeighIn[] =>
    Array.from({ length: 14 }, (_, i) => ({
      dayKey: addDays(TODAY, -13 + i),
      kg: start + perDay * i,
      at: 0,
    }));

  it('computes the weekly change of the 7-day average', () => {
    const pct = weeklyWeightChangePct(weighIns(100, -0.2), TODAY)!;
    expect(pct).toBeCloseTo(-1.43, 1);
  });

  it('warns about losing faster than 1% a week', () => {
    expect(assessWeightRate('down', -1.4)?.id).toBe('losing_fast');
    expect(assessWeightRate('down', -0.7)).toBeNull();
  });

  it('notes fast gains for a bulk', () => {
    expect(assessWeightRate('up', 1)?.id).toBe('gaining_fast');
    expect(assessWeightRate('up', 0.4)).toBeNull();
  });
});

describe('recoveryTargets', () => {
  it('scales protein and water with body weight', () => {
    const t = recoveryTargets(80, 'grow', true);
    expect(t.proteinG).toEqual([128, 176]);
    expect(t.waterMl).toBe(3550);
  });
});

const rested: ReadinessInput = { sleepHours: 8, sleepQuality: 4, energy: 4, stress: 2, soreness: {}, pain: [] };

describe('readiness', () => {
  it('scores a rested lifter as ready', () => {
    expect(scoreReadiness(rested).band).toBe('ready');
  });

  it('scores a short night with heavy soreness as tired or worse', () => {
    const result = scoreReadiness({ ...rested, sleepHours: 4.5, sleepQuality: 2, energy: 2, soreness: { quads: 3 } });
    expect(['tired', 'drained']).toContain(result.band);
    expect(result.notes.join(' ')).toMatch(/six hours/);
  });

  it('trims volume and load when tired but keeps the session', () => {
    const input = { ...rested, sleepHours: 5, energy: 2, stress: 4 };
    const result = scoreReadiness(input);
    const adjusted = adjustPlanForReadiness(chestDay, input, result, ['barbell', 'bench', 'dumbbells', 'cable']);
    expect(adjusted.day.exercises).toHaveLength(3);
    expect(adjusted.loadFactor).toBeLessThan(1);
    expect(adjusted.day.exercises.every((e) => e.sets <= 3)).toBe(true);
  });

  it('swaps out exercises that load a painful joint', () => {
    const input: ReadinessInput = { ...rested, pain: ['shoulder'] };
    const adjusted = adjustPlanForReadiness(chestDay, input, scoreReadiness(input), ['barbell', 'bench', 'dumbbells', 'cable', 'machines']);
    for (const planned of adjusted.day.exercises) {
      expect(getExercise(planned.exerciseId).joints).not.toContain('shoulder');
    }
    expect(adjusted.changes.length).toBeGreaterThan(0);
  });

  it('eases off sore muscles', () => {
    const input: ReadinessInput = { ...rested, soreness: { chest: 2 } };
    const adjusted = adjustPlanForReadiness(chestDay, input, scoreReadiness(input), ['barbell', 'bench', 'dumbbells', 'cable']);
    expect(adjusted.day.exercises[0].sets).toBe(3);
  });
});

describe('weekly plan totals', () => {
  const day = (id: string, exercises: [string, number][]): ProgramDay => ({
    id,
    name: id,
    label: id,
    exercises: exercises.map(([exerciseId, sets], i) => ({ id: `${id}${i}`, exerciseId, sets, repMin: 8, repMax: 12, restSec: 90 })),
  });
  const push = day('push', [['bench_press', 3], ['overhead_press', 3]]);
  const pull = day('pull', [['barbell_row', 3], ['pull_up', 3], ['barbell_curl', 2]]);

  it('cycles the program days across the sessions in a week', () => {
    const totals = weeklyPlanSets([push, pull], 3);
    // push, pull, push
    expect(totals.chest).toBe(6);
    expect(totals.back).toBe(6);
  });

  it('counts upper body push against pull sets', () => {
    expect(pushPullBalance([push, pull], 2)).toEqual({ push: 6, pull: 8 });
    expect(pushPullBalance([], 3)).toEqual({ push: 0, pull: 0 });
  });
});
