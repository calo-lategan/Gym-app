import { addDays } from '../dates';
import { generateProgram } from '../program';
import { applySet, type ExerciseRecord, type PrEvent } from '../records';
import { createRng } from '../rng';
import { defaultSchedule } from '../schedule';
import { getExercise } from '../exercises';
import type { Goal, SetLog, WorkoutSession } from '../types';
import { BALANCE } from './balance';
import { bossSetSucceeds, canAttemptBoss, createBoss, createBossChallenge } from './boss';
import { crossedPhases, dragonHealth, goalProgress, newDragon } from './dragon';
import { advanceDungeon, isBossFloor, newDungeon, zoneForFloor } from './dungeon';
import { generateItem, nextPity, rollRarity } from './loot';
import { addXp, buy, effectiveStats, newHero, salvage, totalXpForLevel, xpToNext } from './progression';
import { resolveWorkout, type GameState } from './rewards';
import { settleStreak } from './streak';

const TODAY = '2026-10-13';

function makeSession(id: string, sets: number, opts: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id,
    dayKey: TODAY,
    programDayId: 'day-0',
    title: 'Push',
    location: 'gym',
    kind: 'standard',
    scheduled: true,
    startedAt: 0,
    endedAt: 3_600_000,
    bodyweightKg: 80,
    exercises: [
      {
        slotId: 's0',
        exerciseId: 'bench_press',
        targetSets: 12,
        repMin: 8,
        repMax: 12,
        restSec: 90,
        sets: Array.from({ length: sets }, (_, i): SetLog => ({
          id: `${id}-${i}`,
          weight: 60,
          reps: 8,
          startedAt: 0,
          endedAt: 30_000,
        })),
      },
    ],
    ...opts,
  };
}

const goal: Goal = { kind: 'bodyweight', start: 90, target: 80, createdAt: 0 };
const freshState = (): GameState => ({
  hero: newHero('Tester', 'knight'),
  dungeon: newDungeon(),
  dragon: newDragon(goal),
});

const pr = (kind: PrEvent['kind'] = 'reps'): PrEvent => ({
  exerciseId: 'bench_press',
  kind,
  setId: 'x',
  value: 9,
  previous: 8,
  weight: 60,
  reps: 9,
});

describe('levels', () => {
  it('uses a gentle early curve that steepens later', () => {
    expect(xpToNext(1)).toBe(120);
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(5) * 2);
  });

  it('carries overflow XP across multiple level ups', () => {
    const { hero, levelsGained } = addXp(newHero('A', 'rogue'), 500);
    expect(levelsGained).toBe(2);
    expect(hero.level).toBe(3);
    expect(hero.xp).toBe(500 - xpToNext(1) - xpToNext(2));
  });

  it('paces level 10 at roughly two to three months of four sessions a week', () => {
    const typicalSession = 16 * BALANCE.xp.perSet + BALANCE.xp.workoutComplete + 1.5 * BALANCE.xp.perPr;
    const weeks = totalXpForLevel(10) / (typicalSession * 4);
    expect(weeks).toBeGreaterThan(6);
    expect(weeks).toBeLessThan(14);
  });
});

describe('loot', () => {
  it('pity timers guarantee a rare within five chests and an epic within fifteen', () => {
    const rng = createRng(1);
    let pity = { sinceRare: 0, sinceEpic: 0 };
    let sinceRare = 0;
    let sinceEpic = 0;
    for (let i = 0; i < 500; i++) {
      const rarity = rollRarity(() => 0, { prCount: 0, floor: 1, pity });
      pity = nextPity(pity, rarity);
      sinceRare = ['rare', 'epic', 'legendary'].includes(rarity) ? 0 : sinceRare + 1;
      sinceEpic = ['epic', 'legendary'].includes(rarity) ? 0 : sinceEpic + 1;
      expect(sinceRare).toBeLessThan(BALANCE.loot.pityRare);
      expect(sinceEpic).toBeLessThan(BALANCE.loot.pityEpic);
      void rng;
    }
  });

  it('PRs improve the odds of better loot', () => {
    const count = (prCount: number) => {
      const rng = createRng(42);
      let good = 0;
      for (let i = 0; i < 4000; i++) {
        const r = rollRarity(rng, { prCount, floor: 1, pity: { sinceRare: 0, sinceEpic: 0 } });
        if (r !== 'common' && r !== 'uncommon') good++;
      }
      return good;
    };
    expect(count(3)).toBeGreaterThan(count(0) * 1.4);
  });

  it('names weapons after the hero class and avoids em dashes', () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      const item = generateItem(rng, 'rare', 'barbarian', 3, TODAY, 'test', 'weapon');
      expect(item.name).toMatch(/axe/i);
      expect(item.name).not.toMatch(/[–—]/);
    }
  });

  it('equipped gear adds to effective stats, salvage pays gold', () => {
    const item = generateItem(createRng(3), 'epic', 'knight', 1, TODAY, 'test', 'weapon');
    let hero = { ...newHero('A', 'knight'), inventory: [item], equipped: { weapon: item.id } };
    expect(effectiveStats(hero).str).toBe(1 + (item.bonus.amount ?? 0));
    hero = { ...hero, equipped: {} };
    const salvaged = salvage(hero, item.id);
    expect(salvaged.inventory).toHaveLength(0);
    expect(salvaged.gold).toBeGreaterThan(hero.gold);
  });

  it('shop purchases respect price and stack limits', () => {
    const hero = { ...newHero('A', 'mage'), gold: 1000 };
    let current = hero;
    for (let i = 0; i < 5; i++) current = buy(current, 'resolve') ?? current;
    expect(current.potions.resolve).toBe(BALANCE.shop.resolve.max);
    expect(buy({ ...hero, gold: 10 }, 'insight')).toBeNull();
  });
});

describe('dungeon', () => {
  const rng = createRng(5);

  it('clears a room per completed workout and seals the gate without a PR', () => {
    let d = newDungeon();
    d = advanceDungeon(d, { completed: true, prCount: 0, completedSets: 12, bossDefeated: false, rng }).dungeon;
    const second = advanceDungeon(d, { completed: true, prCount: 0, completedSets: 12, bossDefeated: false, rng });
    expect(second.dungeon.floor).toBe(1);
    expect(second.events.map((e) => e.type)).toContain('gate_sealed');
  });

  it('opens the gate and descends once rooms are cleared and a PR was set on the floor', () => {
    let d = newDungeon();
    d = advanceDungeon(d, { completed: true, prCount: 1, completedSets: 12, bossDefeated: false, rng }).dungeon;
    const result = advanceDungeon(d, { completed: true, prCount: 0, completedSets: 12, bossDefeated: false, rng });
    expect(result.dungeon.floor).toBe(2);
    expect(result.dungeon.roomsCleared).toBe(0);
    expect(result.dungeon.sigils).toBe(0);
  });

  it('a PR after the gate sealed opens it on the next session', () => {
    let d = { ...newDungeon(), roomsCleared: BALANCE.dungeon.roomsPerFloor };
    d = advanceDungeon(d, { completed: true, prCount: 1, completedSets: 12, bossDefeated: false, rng }).dungeon;
    expect(d.floor).toBe(2);
  });

  it('puts a miniboss on every fifth floor that must be defeated to go deeper', () => {
    expect(isBossFloor(5)).toBe(true);
    let d = { ...newDungeon(), floor: 5, roomsCleared: 1 };
    const program = generateProgram({ focus: 'grow', experience: 'beginner', daysPerWeek: 3, equipment: ['barbell', 'rack', 'bench'] });
    const createBossFn = (floor: number) => createBoss(floor, '2026-W42', program, {});
    d = advanceDungeon(d, { completed: true, prCount: 3, completedSets: 12, bossDefeated: false, createBoss: createBossFn, rng }).dungeon;
    expect(d.boss).not.toBeNull();
    expect(d.floor).toBe(5);
    d = advanceDungeon(d, { completed: true, prCount: 0, completedSets: 12, bossDefeated: true, rng }).dungeon;
    expect(d.floor).toBe(6);
    expect(d.bossesDefeated).toHaveLength(1);
  });

  it('names zones and cycles them deeper down', () => {
    expect(zoneForFloor(1).name).toBe('The Sunken Gate');
    expect(zoneForFloor(6).name).toBe('The Bone Warrens');
    expect(zoneForFloor(40).name).toMatch(/depth/);
  });
});

describe('miniboss challenges', () => {
  const program = generateProgram({ focus: 'grow', experience: 'beginner', daysPerWeek: 3, equipment: ['barbell', 'rack', 'bench'] });
  const bench = getExercise('bench_press');
  const records: Record<string, ExerciseRecord> = {
    bench_press: [
      { id: 'a', weight: 60, reps: 8, startedAt: 0, endedAt: 1 },
      { id: 'b', weight: 65, reps: 5, startedAt: 0, endedAt: 1 },
    ].reduce<ExerciseRecord | undefined>((r, s) => applySet(r, s, bench, TODAY), undefined)!,
  };

  it('asks for a little more than the current best', () => {
    const challenge = createBossChallenge(10, program, records);
    expect(challenge.exerciseId).toBe('bench_press');
    if (challenge.kind === 'weight') {
      expect(challenge.weight).toBeGreaterThan(65);
      expect(challenge.target).toBe(5);
    } else {
      expect(challenge.target).toBeGreaterThan(5);
    }
  });

  it('allows one attempt per week and checks the boss set', () => {
    const boss = createBoss(5, '2026-W42', program, records);
    expect(canAttemptBoss(boss, '2026-W42')).toBe(true);
    expect(canAttemptBoss({ ...boss, lastAttemptWeek: '2026-W42' }, '2026-W42')).toBe(false);
    const c = boss.challenge;
    expect(bossSetSucceeds(c, { id: 'x', weight: c.weight, reps: c.target, startedAt: 0, endedAt: 1 })).toBe(true);
    expect(bossSetSucceeds(c, { id: 'x', weight: c.weight, reps: c.target - 1, startedAt: 0, endedAt: 1 })).toBe(false);
  });
});

describe('dragon', () => {
  it('can only be slain when the goal is reached', () => {
    expect(goalProgress(goal, 90)).toBe(0);
    expect(goalProgress(goal, 85)).toBeCloseTo(0.5);
    expect(dragonHealth(goalProgress(goal, 85))).toBeCloseTo(0.5);
    expect(goalProgress(goal, 79)).toBe(1);
    expect(goalProgress(goal, 95)).toBe(0);
  });

  it('works for strength and session goals', () => {
    expect(goalProgress({ kind: 'lift', start: 80, target: 100, exerciseId: 'bench_press', createdAt: 0 }, 90)).toBeCloseTo(0.5);
    expect(goalProgress({ kind: 'sessions', start: 0, target: 40, createdAt: 0 }, 10)).toBeCloseTo(0.25);
  });

  it('announces each phase only once', () => {
    expect(crossedPhases(0, 0.55).map((p) => p.threshold)).toEqual([0.25, 0.5]);
    expect(crossedPhases(0.55, 0.6)).toEqual([]);
  });
});

describe('streaks', () => {
  const schedule = defaultSchedule(); // Mon, Tue, Thu, Fri

  it('counts completed scheduled days and ignores rest days', () => {
    const hero = { ...newHero('A', 'knight'), streak: { current: 0, best: 0, lastEvaluated: '2026-10-04' } };
    const done = new Set(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-12']);
    const result = settleStreak(hero, schedule, done, TODAY);
    expect(result.hero.streak.current).toBe(5);
    expect(result.events).toEqual([]);
  });

  it('uses a Potion of Resolve on a missed day, then resets when none are left', () => {
    const hero = { ...newHero('A', 'knight'), streak: { current: 4, best: 4, lastEvaluated: '2026-10-04' } };
    const result = settleStreak(hero, schedule, new Set(['2026-10-05']), '2026-10-10');
    // Missed Tue 6 (potion), Thu 8 and Fri 9 (reset).
    expect(result.events.map((e) => e.type)).toEqual(['shield_used', 'streak_lost']);
    expect(result.hero.streak.current).toBe(0);
    expect(result.hero.potions.resolve).toBe(0);
    expect(result.hero.streak.best).toBe(5);
  });
});

describe('resolveWorkout', () => {
  const createBossFn = () => null;

  it('rewards a completed scheduled workout with STR, XP, gold, a chest and a cleared room', () => {
    const outcome = resolveWorkout({
      state: freshState(),
      session: makeSession('w1', 12),
      prs: [],
      today: TODAY,
      createBoss: createBossFn,
      firstScheduledToday: true,
    });
    expect(outcome.completed).toBe(true);
    expect(outcome.statGains.str).toBe(1);
    expect(outcome.xp.total).toBeGreaterThan(200);
    expect(outcome.gold).toBeGreaterThan(0);
    expect(outcome.loot.some((l) => l.source === 'chest')).toBe(true);
    expect(outcome.dungeonEvents.map((e) => e.type)).toContain('room_cleared');
    expect(outcome.state.hero.streak.current).toBe(1);
    expect(outcome.levelsGained).toBeGreaterThanOrEqual(1);
  });

  it('gives no STR on a rest day bonus session, but still XP', () => {
    const outcome = resolveWorkout({
      state: freshState(),
      session: makeSession('w2', 12, { scheduled: false }),
      prs: [],
      today: TODAY,
      createBoss: createBossFn,
      firstScheduledToday: false,
    });
    expect(outcome.statGains.str).toBeUndefined();
    expect(outcome.xp.total).toBeGreaterThan(0);
    expect(outcome.state.hero.streak.current).toBe(0);
  });

  it('treats a session below the completion threshold as partial', () => {
    const outcome = resolveWorkout({
      state: freshState(),
      session: makeSession('w3', 2),
      prs: [],
      today: TODAY,
      createBoss: createBossFn,
      firstScheduledToday: true,
    });
    expect(outcome.completed).toBe(false);
    expect(outcome.loot).toHaveLength(0);
    expect(outcome.statGains.str).toBeUndefined();
    expect(outcome.dungeonEvents.some((e) => e.type === 'room_cleared')).toBe(false);
  });

  it('turns rep and speed records into END and AGI, capped per session', () => {
    const outcome = resolveWorkout({
      state: freshState(),
      session: makeSession('w4', 12),
      prs: [pr('reps'), pr('reps'), pr('reps'), pr('speed')],
      today: TODAY,
      createBoss: createBossFn,
      firstScheduledToday: true,
    });
    expect(outcome.statGains.end).toBe(BALANCE.stats.maxEndPerSession);
    expect(outcome.statGains.agi).toBe(1);
    expect(outcome.xp.prs).toBe(4 * BALANCE.xp.perPr);
  });

  it('is deterministic for the same session id', () => {
    const run = () =>
      resolveWorkout({
        state: freshState(),
        session: makeSession('same', 12),
        prs: [pr()],
        today: TODAY,
        createBoss: createBossFn,
        firstScheduledToday: true,
      }).loot.map((l) => `${l.item.rarity}:${l.item.slot}:${l.item.power}`);
    expect(run()).toEqual(run());
  });

  it('applies the streak bonus to XP', () => {
    const state = freshState();
    state.hero = { ...state.hero, streak: { current: 9, best: 9, lastEvaluated: addDays(TODAY, -1) } };
    const outcome = resolveWorkout({
      state,
      session: makeSession('w5', 12),
      prs: [],
      today: TODAY,
      createBoss: createBossFn,
      firstScheduledToday: true,
    });
    expect(outcome.xp.bonusPct).toBe(30);
  });
});
