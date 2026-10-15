import { BALANCE } from './balance';
import type { BossState, DungeonState, JournalEntry } from '../types';

export type MonsterKind = 'skeleton_minion' | 'skeleton_rogue' | 'skeleton_mage' | 'skeleton_warrior';

export interface Zone {
  index: number;
  name: string;
  /** Torch and fog tint for the 3D scene. */
  light: string;
  fog: string;
  monsters: MonsterKind[];
  monsterNames: string[];
}

const ZONES: Omit<Zone, 'index'>[] = [
  {
    name: 'The Sunken Gate',
    light: '#ffb45e',
    fog: '#0d1416',
    monsters: ['skeleton_minion'],
    monsterNames: ['Rattling Minion', 'Gravecrawler', 'Bone Skitter'],
  },
  {
    name: 'The Bone Warrens',
    light: '#9be37a',
    fog: '#0c140d',
    monsters: ['skeleton_minion', 'skeleton_rogue'],
    monsterNames: ['Warren Cutthroat', 'Marrow Thief', 'Rattling Minion'],
  },
  {
    name: 'Crypt of Echoes',
    light: '#b78cff',
    fog: '#110c18',
    monsters: ['skeleton_rogue', 'skeleton_mage'],
    monsterNames: ['Echo Wraith', 'Crypt Adept', 'Hollow Stalker'],
  },
  {
    name: 'The Molten Forge',
    light: '#ff7a3d',
    fog: '#180c08',
    monsters: ['skeleton_warrior', 'skeleton_mage'],
    monsterNames: ['Forge Revenant', 'Cinder Acolyte', 'Slag Guard'],
  },
  {
    name: 'Obsidian Halls',
    light: '#5fe0d0',
    fog: '#081414',
    monsters: ['skeleton_warrior', 'skeleton_rogue', 'skeleton_mage'],
    monsterNames: ['Obsidian Sentinel', 'Glass Duelist', 'Void Chanter'],
  },
  {
    name: "The Wyrm's Descent",
    light: '#ff4f3a',
    fog: '#160707',
    monsters: ['skeleton_warrior', 'skeleton_mage'],
    monsterNames: ['Wyrm Cultist', 'Ashbound Knight', 'Scale Warden'],
  },
];

export const ZONE_COUNT = ZONES.length;

const BOSS_NAMES = [
  'Grukk, the Rattling Warchief',
  'Mordrel, Bone Warden',
  'The Lich of Lethargy',
  'Cinderjaw, Forge Revenant',
  'Queen Vessa of the Black Halls',
  'Skarn, Herald of the Wyrm',
];

export function zoneForFloor(floor: number): Zone {
  const index = Math.floor((Math.max(1, floor) - 1) / BALANCE.dungeon.bossEvery);
  const zone = ZONES[Math.min(index, ZONES.length - 1)];
  const loops = Math.max(0, index - (ZONES.length - 1));
  return { ...zone, index, name: loops > 0 ? `${zone.name}, depth ${loops + 1}` : zone.name };
}

export function isBossFloor(floor: number): boolean {
  return floor % BALANCE.dungeon.bossEvery === 0;
}

export function bossNameForFloor(floor: number): string {
  const index = Math.floor(floor / BALANCE.dungeon.bossEvery) - 1;
  const base = BOSS_NAMES[index % BOSS_NAMES.length];
  return index >= BOSS_NAMES.length ? `Ascended ${base}` : base;
}

export function newDungeon(): DungeonState {
  return { floor: 1, roomsCleared: 0, sigils: 0, boss: null, bossesDefeated: [], journal: [] };
}

export type DungeonEvent =
  | { type: 'room_cleared'; room: number; monsters: string[] }
  | { type: 'sigil' }
  | { type: 'gate_sealed' }
  | { type: 'boss_chamber' }
  | { type: 'boss_defeated'; name: string }
  | { type: 'descended'; floor: number; zone: string; newZone: boolean };

export interface AdvanceInput {
  completed: boolean;
  prCount: number;
  completedSets: number;
  bossDefeated: boolean;
  /** Called when the lifter reaches a boss chamber, to build the challenge. */
  createBoss?: (floor: number) => BossState | null;
  rng: () => number;
}

export function monstersForSets(floor: number, completedSets: number, rng: () => number): string[] {
  const zone = zoneForFloor(floor);
  const count = Math.max(1, Math.ceil(completedSets / BALANCE.dungeon.setsPerMonster));
  return Array.from({ length: count }, () => zone.monsterNames[Math.floor(rng() * zone.monsterNames.length)]);
}

/**
 * Moves the lifter through the dungeon after a workout. A completed session
 * clears a room. Normal floors are sealed until a personal record is set on
 * them. Every fifth floor is guarded by a miniboss that must be beaten.
 */
export function advanceDungeon(dungeon: DungeonState, input: AdvanceInput): { dungeon: DungeonState; events: DungeonEvent[] } {
  const rooms = BALANCE.dungeon.roomsPerFloor;
  const events: DungeonEvent[] = [];
  let next: DungeonState = { ...dungeon };

  if (input.completed && next.roomsCleared < rooms) {
    next.roomsCleared += 1;
    events.push({
      type: 'room_cleared',
      room: next.roomsCleared,
      monsters: monstersForSets(next.floor, input.completedSets, input.rng),
    });
  }
  if (input.prCount > 0) {
    next.sigils += 1;
    events.push({ type: 'sigil' });
  }

  const roomsDone = next.roomsCleared >= rooms;
  if (isBossFloor(next.floor)) {
    if (input.bossDefeated && next.boss) {
      events.push({ type: 'boss_defeated', name: next.boss.name });
      next.bossesDefeated = [...next.bossesDefeated, next.boss.name];
      next = descend(next, events);
    } else if (roomsDone && !next.boss) {
      next.boss = input.createBoss?.(next.floor) ?? null;
      if (next.boss) events.push({ type: 'boss_chamber' });
    }
  } else if (roomsDone && next.sigils > 0) {
    next = descend(next, events);
  } else if (roomsDone && input.completed) {
    events.push({ type: 'gate_sealed' });
  }
  return { dungeon: next, events };
}

function descend(dungeon: DungeonState, events: DungeonEvent[]): DungeonState {
  const floor = dungeon.floor + 1;
  const zone = zoneForFloor(floor);
  const newZone = zoneForFloor(dungeon.floor).index !== zone.index;
  events.push({ type: 'descended', floor, zone: zone.name, newZone });
  return { ...dungeon, floor, roomsCleared: 0, sigils: 0, boss: null };
}

export function journalEntry(dayKey: string, kind: JournalEntry['kind'], text: string): JournalEntry {
  return { id: `${dayKey}-${kind}-${Math.random().toString(36).slice(2, 8)}`, dayKey, kind, text };
}

export function appendJournal(dungeon: DungeonState, entries: JournalEntry[]): DungeonState {
  return { ...dungeon, journal: [...entries.reverse(), ...dungeon.journal].slice(0, 60) };
}
