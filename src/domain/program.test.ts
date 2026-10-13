import { getExercise, isAvailable } from './exercises';
import { generateProgram, homeVersionOfDay, recoveryDay, schemeFor, splitForDays } from './program';
import { ALL_EQUIPMENT } from './substitution';
import type { EquipmentId, MuscleGroup } from './types';

const FULL_GYM = ALL_EQUIPMENT;

describe('splitForDays', () => {
  it('picks a split that fits the number of training days', () => {
    expect(splitForDays(2)).toBe('full_body');
    expect(splitForDays(3)).toBe('full_body');
    expect(splitForDays(4)).toBe('upper_lower');
    expect(splitForDays(5)).toBe('ppl_ul');
    expect(splitForDays(6)).toBe('ppl');
  });
});

describe('generateProgram', () => {
  it('builds one day per template with only available exercises', () => {
    const equipment: EquipmentId[] = ['dumbbells', 'bench'];
    const program = generateProgram({ focus: 'grow', experience: 'beginner', daysPerWeek: 4, equipment });
    expect(program.days).toHaveLength(4);
    for (const day of program.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(5);
      for (const planned of day.exercises) {
        expect(isAvailable(getExercise(planned.exerciseId), equipment)).toBe(true);
      }
      const ids = day.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('balances pushing and pulling across the week', () => {
    const program = generateProgram({ focus: 'grow', experience: 'intermediate', daysPerWeek: 6, equipment: FULL_GYM });
    let push = 0;
    let pull = 0;
    for (const day of program.days) {
      for (const planned of day.exercises) {
        const pattern = getExercise(planned.exerciseId).pattern;
        if (['h_push', 'v_push', 'chest_fly'].includes(pattern)) push += planned.sets;
        if (['h_pull', 'v_pull', 'rear_delt'].includes(pattern)) pull += planned.sets;
      }
    }
    expect(pull).toBeGreaterThanOrEqual(push * 0.8);
  });

  it('hits every major muscle group each week', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const program = generateProgram({ focus: 'fit', experience: 'beginner', daysPerWeek: days, equipment: FULL_GYM });
      const hit = new Set<MuscleGroup>();
      for (const day of program.days) {
        for (const planned of day.exercises) getExercise(planned.exerciseId).primary.forEach((m) => hit.add(m));
      }
      for (const muscle of ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes'] as const) {
        expect(hit.has(muscle)).toBe(true);
      }
    }
  });

  it('still produces a complete plan with no equipment at all', () => {
    const program = generateProgram({ focus: 'lean', experience: 'beginner', daysPerWeek: 3, equipment: [] });
    for (const day of program.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(5);
      for (const planned of day.exercises) expect(getExercise(planned.exerciseId).equipment).toEqual([]);
    }
  });

  it('adds a conditioning finisher for fit and lean goals only', () => {
    const lean = generateProgram({ focus: 'lean', experience: 'beginner', daysPerWeek: 3, equipment: FULL_GYM });
    const grow = generateProgram({ focus: 'grow', experience: 'beginner', daysPerWeek: 3, equipment: FULL_GYM });
    const last = (p: typeof lean) => getExercise(p.days[0].exercises.at(-1)!.exerciseId).kind;
    expect(last(lean)).toBe('conditioning');
    expect(last(grow)).not.toBe('conditioning');
  });
});

describe('schemeFor', () => {
  it('uses heavier, longer-rest work for muscle gain than for fat loss', () => {
    const grow = schemeFor('grow', 'main', 'intermediate', false);
    const lean = schemeFor('lean', 'main', 'intermediate', false);
    expect(grow.repMax).toBeLessThan(lean.repMax);
    expect(grow.restSec).toBeGreaterThan(lean.restSec);
  });
});

describe('homeVersionOfDay', () => {
  it('swaps gym exercises for what is available at home', () => {
    const program = generateProgram({ focus: 'grow', experience: 'beginner', daysPerWeek: 4, equipment: FULL_GYM });
    const home = homeVersionOfDay(program.days[0], ['bands']);
    expect(home.exercises.length).toBe(program.days[0].exercises.length);
    for (const planned of home.exercises) {
      expect(isAvailable(getExercise(planned.exerciseId), ['bands'])).toBe(true);
    }
  });
});

describe('recoveryDay', () => {
  it('only contains gentle work', () => {
    for (const planned of recoveryDay().exercises) {
      expect(['mobility', 'isolation', 'conditioning']).toContain(getExercise(planned.exerciseId).kind);
    }
  });
});
