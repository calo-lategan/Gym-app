import { EXERCISES, getExercise, isAvailable } from './exercises';
import { bestSubstitute, findAlternatives } from './substitution';
import type { EquipmentId } from './types';

describe('exercise library', () => {
  it('has unique ids and sensible metadata', () => {
    const ids = new Set<string>();
    for (const e of EXERCISES) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.primary.length).toBeGreaterThan(0);
      expect(e.bodyweightFactor).toBeGreaterThanOrEqual(0);
      expect(e.bodyweightFactor).toBeLessThanOrEqual(1);
      expect(e.cue.length).toBeGreaterThan(10);
      // Copy rule: no em or en dashes in user-facing text.
      expect(e.name + e.cue).not.toMatch(/[–—]/);
    }
  });

  it('has a body weight option for every main movement pattern', () => {
    const patterns = ['squat', 'lunge', 'hinge', 'h_push', 'v_push', 'h_pull', 'v_pull', 'core'];
    for (const p of patterns) {
      expect(EXERCISES.some((e) => e.pattern === p && e.equipment.length === 0)).toBe(true);
    }
  });
});

describe('findAlternatives', () => {
  it('only suggests exercises the lifter can actually do', () => {
    const equipment: EquipmentId[] = ['dumbbells'];
    const alts = findAlternatives('bench_press', equipment);
    expect(alts.length).toBeGreaterThan(0);
    for (const alt of alts) expect(isAvailable(alt.exercise, equipment)).toBe(true);
  });

  it('prefers the same movement pattern and muscles', () => {
    const alts = findAlternatives('bench_press', ['dumbbells', 'bench']);
    expect(alts[0].exercise.pattern).toBe('h_push');
    expect(alts[0].exercise.primary).toContain('chest');
  });

  it('falls back to body weight when no equipment is available', () => {
    const alts = findAlternatives('lat_pulldown', []);
    expect(alts.map((a) => a.exercise.id)).toEqual(expect.arrayContaining(['towel_door_row', 'table_row']));
  });

  it('never swaps a timed exercise for a rep exercise', () => {
    for (const alt of findAlternatives('plank', ALL)) {
      expect(alt.exercise.measure).toBe('time');
    }
  });
});

describe('bestSubstitute', () => {
  it('keeps the original when the equipment is there', () => {
    expect(bestSubstitute('back_squat', ['barbell', 'rack'])?.id).toBe('back_squat');
  });

  it('swaps barbell squats for a squat pattern at home', () => {
    const sub = bestSubstitute('back_squat', []);
    expect(sub && getExercise(sub.id).pattern).toBe('squat');
  });
});

const ALL: EquipmentId[] = ['barbell', 'rack', 'bench', 'dumbbells', 'kettlebell', 'cable', 'machines', 'pullup_bar', 'dip_bars', 'bands', 'cardio'];
