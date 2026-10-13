import { findExercise } from '../exercises';
import type { PrEvent } from '../records';
import { createRng, hashString } from '../rng';
import type {
  BossState,
  DayKey,
  DragonState,
  DungeonState,
  Hero,
  Item,
  JournalEntry,
  Rarity,
  Stats,
  WorkoutSession,
} from '../types';
import { BALANCE } from './balance';
import { bossSetSucceeds } from './boss';
import { advanceDungeon, appendJournal, journalEntry, zoneForFloor, type DungeonEvent } from './dungeon';
import { generateItem, nextPity, rollRarity } from './loot';
import { addXp, autoEquip, gearGoldBonusPct, gearXpBonusPct } from './progression';
import { creditToday, streakBonusPct } from './streak';

export interface GameState {
  hero: Hero;
  dungeon: DungeonState;
  dragon: DragonState;
}

export interface LootDrop {
  item: Item;
  source: 'chest' | 'floor' | 'boss' | 'level';
  equipped: boolean;
}

export interface XpBreakdown {
  sets: number;
  completion: number;
  prs: number;
  boss: number;
  bonusPct: number;
  total: number;
}

export interface WorkoutOutcome {
  completed: boolean;
  completedSets: number;
  plannedSets: number;
  setsNeeded: number;
  xp: XpBreakdown;
  gold: number;
  statGains: Partial<Stats>;
  levelBefore: number;
  levelsGained: number;
  prs: PrEvent[];
  loot: LootDrop[];
  dungeonEvents: DungeonEvent[];
  boss: { name: string; success: boolean } | null;
  streak: { before: number; after: number };
  state: GameState;
}

export function completedSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((sum, e) => sum + e.sets.filter((s) => s.reps > 0).length, 0);
}

export function plannedSetCount(session: WorkoutSession): number {
  return session.exercises.reduce((sum, e) => sum + e.targetSets, 0);
}

export function setsNeededToComplete(session: WorkoutSession): number {
  const planned = plannedSetCount(session);
  return Math.max(Math.min(BALANCE.completion.minSets, planned), Math.ceil(planned * BALANCE.completion.minShare));
}

export interface ResolveInput {
  state: GameState;
  session: WorkoutSession;
  prs: PrEvent[];
  today: DayKey;
  /** Builds the floor's miniboss when its chamber is reached. */
  createBoss: (floor: number) => BossState | null;
  /** True when this is the first completed scheduled session today. */
  firstScheduledToday: boolean;
}

/**
 * Turns a finished workout into game progress: XP, gold, stats, loot, dungeon
 * movement and the miniboss result. Pure and deterministic for a given
 * session id, so the victory screen can be rebuilt identically.
 */
export function resolveWorkout(input: ResolveInput): WorkoutOutcome {
  const { session, prs, today } = input;
  const rng = createRng(hashString(session.id));
  let hero = input.state.hero;
  let dungeon = input.state.dungeon;
  const journal: JournalEntry[] = [];

  const completedSets = completedSetCount(session);
  const plannedSets = plannedSetCount(session);
  const setsNeeded = setsNeededToComplete(session);
  const completed = completedSets >= setsNeeded;

  // ── Boss attempt ────────────────────────────────────────────
  let bossResult: WorkoutOutcome['boss'] = null;
  let bossDefeated = false;
  const bossSets = session.exercises.flatMap((e) => e.sets.filter((s) => s.isBoss));
  if (session.bossAttempt && dungeon.boss && bossSets.length > 0) {
    bossDefeated = bossSets.some((s) => bossSetSucceeds(session.bossAttempt!.challenge, s));
    bossResult = { name: dungeon.boss.name, success: bossDefeated };
  }

  // ── Stats ───────────────────────────────────────────────────
  const statGains: Partial<Stats> = {};
  const gain = (k: keyof Stats, n: number) => {
    if (n <= 0) return;
    statGains[k] = (statGains[k] ?? 0) + n;
  };
  if (completed && session.scheduled && input.firstScheduledToday) gain('str', 1);
  const repPrs = prs.filter((p) => p.kind === 'reps' || p.kind === 'hold').length;
  const speedPrs = prs.filter((p) => p.kind === 'speed').length;
  gain('end', Math.min(BALANCE.stats.maxEndPerSession, repPrs));
  gain('agi', Math.min(BALANCE.stats.maxAgiPerSession, speedPrs));

  // ── XP ──────────────────────────────────────────────────────
  const bossSetCount = bossSets.length;
  const setsXp =
    (completedSets - bossSetCount) * BALANCE.xp.perSet +
    bossSetCount * BALANCE.xp.perSet * BALANCE.xp.bossSetMultiplier;
  const completionXp = completed
    ? session.kind === 'recovery'
      ? BALANCE.xp.recoveryComplete
      : BALANCE.xp.workoutComplete
    : 0;
  const prXp = Math.min(prs.length, BALANCE.xp.maxPrsPerSession) * BALANCE.xp.perPr;
  const bossXp = bossDefeated ? BALANCE.xp.bossVictory : 0;
  const streakBefore = hero.streak.current;
  if (completed && session.scheduled && input.firstScheduledToday) hero = creditToday(hero, today);
  const bonusPct =
    streakBonusPct(hero.streak.current, BALANCE.xp.streakPctPerDay, BALANCE.xp.streakPctCap) +
    gearXpBonusPct(hero) +
    (hero.insightActive && completed ? BALANCE.xp.insightPct : 0);
  const baseXp = setsXp + completionXp + prXp + bossXp;
  const totalXp = Math.round(baseXp * (1 + bonusPct / 100));
  if (hero.insightActive && completed) hero = { ...hero, insightActive: false };

  // ── Dungeon ─────────────────────────────────────────────────
  const floorBefore = dungeon.floor;
  const advanced = advanceDungeon(dungeon, {
    completed,
    prCount: prs.length,
    completedSets,
    bossDefeated,
    createBoss: input.createBoss,
    rng,
  });
  dungeon = advanced.dungeon;
  if (bossResult && !bossDefeated && dungeon.boss) {
    dungeon = { ...dungeon, boss: { ...dungeon.boss, attempts: dungeon.boss.attempts + 1 } };
  }

  // ── Gold ────────────────────────────────────────────────────
  const monsters = advanced.events.flatMap((e) => (e.type === 'room_cleared' ? e.monsters : []));
  let gold = 0;
  if (completed) {
    gold += BALANCE.gold.workoutBase + floorBefore * BALANCE.gold.perFloor;
    gold += monsters.length * BALANCE.gold.perMonster;
  }
  gold += Math.min(prs.length, BALANCE.xp.maxPrsPerSession) * BALANCE.gold.perPr;
  if (bossDefeated) gold += BALANCE.gold.bossVictory;
  gold = Math.round(gold * (1 + gearGoldBonusPct(hero) / 100));

  // ── Loot ────────────────────────────────────────────────────
  const loot: LootDrop[] = [];
  const drop = (source: LootDrop['source'], minimum?: Rarity) => {
    const rarity = rollRarity(rng, { prCount: prs.length, floor: dungeon.floor, pity: hero.pity, minimum });
    hero = { ...hero, pity: nextPity(hero.pity, rarity) };
    const label = source === 'boss' ? 'Boss hoard' : source === 'floor' ? `Floor ${floorBefore} vault` : 'Room chest';
    const item = generateItem(rng, rarity, hero.heroClass, dungeon.floor, today, label);
    hero = { ...hero, inventory: [item, ...hero.inventory].slice(0, BALANCE.loot.inventoryCap) };
    const equipped = autoEquip(hero, item);
    hero = equipped.hero;
    loot.push({ item, source, equipped: equipped.equipped });
  };
  if (completed) drop('chest');
  if (advanced.events.some((e) => e.type === 'descended')) drop('floor');
  if (bossDefeated) drop('boss', rng() < 0.15 ? 'legendary' : 'epic');

  // ── Apply XP, stats and gold ────────────────────────────────
  const levelBefore = hero.level;
  const xpResult = addXp(hero, totalXp);
  hero = xpResult.hero;
  const stats = { ...hero.stats };
  for (const [k, v] of Object.entries(statGains) as [keyof Stats, number][]) stats[k] += v;
  hero = { ...hero, stats, gold: hero.gold + gold };
  if (xpResult.levelsGained > 0) {
    let levelGold = 0;
    for (let l = levelBefore + 1; l <= hero.level; l++) levelGold += l * BALANCE.gold.levelUpPerLevel;
    hero = { ...hero, gold: hero.gold + levelGold };
    // Every fifth level awards a guaranteed rare chest.
    for (let l = levelBefore + 1; l <= hero.level; l++) if (l % 5 === 0) drop('level', 'rare');
  }

  // ── Journal ─────────────────────────────────────────────────
  for (const event of advanced.events) {
    if (event.type === 'room_cleared') {
      journal.push(journalEntry(today, 'room', `Cleared room ${event.room} of floor ${floorBefore}, felling ${event.monsters.length} ${event.monsters.length === 1 ? 'foe' : 'foes'}.`));
    } else if (event.type === 'gate_sealed') {
      journal.push(journalEntry(today, 'gate', `The gate of floor ${floorBefore} is sealed. Break a personal record to open it.`));
    } else if (event.type === 'descended') {
      journal.push(journalEntry(today, 'descend', `Descended to floor ${event.floor}${event.newZone ? `, entering ${event.zone}` : ''}.`));
    } else if (event.type === 'boss_chamber') {
      journal.push(journalEntry(today, 'boss', `${dungeon.boss?.name ?? 'A guardian'} blocks the way down.`));
    } else if (event.type === 'boss_defeated') {
      journal.push(journalEntry(today, 'boss', `Defeated ${event.name}.`));
    }
  }
  for (const pr of prs.slice(0, 3)) {
    journal.push(journalEntry(today, 'pr', `New record on ${findExercise(pr.exerciseId)?.name ?? 'an exercise'}.`));
  }
  for (const l of loot.filter((d) => d.item.rarity !== 'common')) {
    journal.push(journalEntry(today, 'loot', `Found ${l.item.name}.`));
  }
  if (xpResult.levelsGained > 0) journal.push(journalEntry(today, 'level', `Reached level ${hero.level}.`));
  dungeon = appendJournal(dungeon, journal);

  return {
    completed,
    completedSets,
    plannedSets,
    setsNeeded,
    xp: { sets: setsXp, completion: completionXp, prs: prXp, boss: bossXp, bonusPct, total: totalXp },
    gold,
    statGains,
    levelBefore,
    levelsGained: xpResult.levelsGained,
    prs,
    loot,
    dungeonEvents: advanced.events,
    boss: bossResult,
    streak: { before: streakBefore, after: hero.streak.current },
    state: { hero, dungeon, dragon: input.state.dragon },
  };
}

export const zoneName = (floor: number) => zoneForFloor(floor).name;
