import type { DragonState, Goal } from '../types';

const DRAGONS = [
  { name: 'Vaelgrith', epithet: 'the Ashen Wyrm' },
  { name: 'Morvanth', epithet: 'the Storm Tyrant' },
  { name: 'Ysveth', epithet: 'the Hollow Flame' },
  { name: 'Karrog', epithet: 'the Mountain That Breathes' },
];

export function dragonForTier(tier: number): { name: string; epithet: string } {
  const base = DRAGONS[(tier - 1) % DRAGONS.length];
  const loops = Math.floor((tier - 1) / DRAGONS.length);
  return loops > 0 ? { name: `Elder ${base.name}`, epithet: base.epithet } : base;
}

export function newDragon(goal: Goal, tier = 1): DragonState {
  const { name, epithet } = dragonForTier(tier);
  return { tier, name, epithet, goal, slain: false, bestProgress: 0 };
}

/**
 * Fraction of the way from the goal's starting value to its target. The
 * dragon's health is the remaining distance, so it can only fall to zero
 * when the real-world goal is reached.
 */
export function goalProgress(goal: Goal, current: number | null): number {
  if (current === null) return 0;
  if (goal.target === goal.start) return 1;
  const raw = (current - goal.start) / (goal.target - goal.start);
  return Math.min(1, Math.max(0, raw));
}

export function dragonHealth(progress: number): number {
  return Math.max(0, 1 - progress);
}

export function canSlay(progress: number): boolean {
  return progress >= 1;
}

export interface DragonPhase {
  threshold: number;
  line: string;
}

const PHASES: DragonPhase[] = [
  { threshold: 0.25, line: 'The dragon stirs. A crack splits its ward.' },
  { threshold: 0.5, line: 'Half its ward is gone. It no longer sleeps when you enter.' },
  { threshold: 0.75, line: 'The dragon is bleeding light. It knows you are coming.' },
  { threshold: 0.9, line: 'One more push. The ward is almost gone.' },
];

/** Phase lines crossed since the best progress recorded so far. */
export function crossedPhases(previousBest: number, progress: number): DragonPhase[] {
  return PHASES.filter((p) => previousBest < p.threshold && progress >= p.threshold);
}

export function describeGoal(goal: Goal, formatLoad: (kg: number) => string, exerciseName?: string): string {
  switch (goal.kind) {
    case 'bodyweight':
      return goal.target < goal.start
        ? `Reach ${formatLoad(goal.target)} body weight`
        : `Build up to ${formatLoad(goal.target)} body weight`;
    case 'lift':
      return `${exerciseName ?? 'Lift'}: estimated max of ${formatLoad(goal.target)}`;
    case 'sessions':
      return `Complete ${goal.target} workouts`;
  }
}
