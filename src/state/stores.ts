import 'expo-sqlite/localStorage/install';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { newDungeon } from '@/domain/game/dungeon';
import { newHero } from '@/domain/game/progression';
import type { DungeonEvent } from '@/domain/game/dungeon';
import type { LootDrop, XpBreakdown } from '@/domain/game/rewards';
import type { ExerciseRecord, PrEvent } from '@/domain/records';
import { defaultSchedule } from '@/domain/schedule';
import type {
  CheckIn,
  DayKey,
  DragonState,
  DungeonState,
  Hero,
  Profile,
  Program,
  Schedule,
  Stats,
  WeighIn,
  WorkoutSession,
} from '@/domain/types';

export interface Settings {
  sound: boolean;
  ambience: boolean;
  haptics: boolean;
  /** `lite` skips 3D during workouts to save battery. */
  graphics: 'full' | 'lite';
  use24h: boolean;
}

export interface RunningSet {
  exerciseIndex: number;
  startedAt: number;
}

export interface ActiveWorkout {
  session: WorkoutSession;
  current: number;
  running: RunningSet | null;
  restEndsAt: number | null;
  restTotalSec: number;
  livePrs: PrEvent[];
  changes: string[];
  recordsAtStart: Record<string, ExerciseRecord>;
  /** Index of the boss exercise in the session, if a miniboss attempt was added. */
  bossIndex: number | null;
}

/** The parts of a workout outcome the victory screen needs. */
export interface StoredOutcome {
  sessionId: string;
  title: string;
  completed: boolean;
  completedSets: number;
  plannedSets: number;
  setsNeeded: number;
  durationSec: number;
  xp: XpBreakdown;
  gold: number;
  statGains: Partial<Stats>;
  levelBefore: number;
  levelAfter: number;
  levelsGained: number;
  prs: PrEvent[];
  loot: LootDrop[];
  dungeonEvents: DungeonEvent[];
  boss: { name: string; success: boolean } | null;
  streak: { before: number; after: number };
  floorBefore: number;
  floorAfter: number;
  dragon: { before: number; after: number; lines: string[] } | null;
  heroClass: Hero['heroClass'];
}

export interface GameState {
  version: number;
  onboarded: boolean;
  profile: Profile;
  schedule: Schedule;
  program: Program | null;
  nextDayIndex: number;
  hero: Hero;
  dungeon: DungeonState;
  dragon: DragonState | null;
  records: Record<string, ExerciseRecord>;
  settings: Settings;
  active: ActiveWorkout | null;
  lastOutcome: StoredOutcome | null;
  lastSettledDay: DayKey | null;
  /** Messages to surface once on the camp screen (streak saved, boss refreshed...). */
  notices: string[];
}

export const defaultProfile = (): Profile => ({
  name: '',
  sex: 'unspecified',
  birthYear: null,
  heightCm: null,
  unit: 'kg',
  experience: 'beginner',
  focus: 'fit',
  gymEquipment: ['barbell', 'rack', 'bench', 'dumbbells', 'cable', 'machines', 'pullup_bar'],
  homeEquipment: [],
});

export const initialGameState = (): GameState => ({
  version: 1,
  onboarded: false,
  profile: defaultProfile(),
  schedule: defaultSchedule(),
  program: null,
  nextDayIndex: 0,
  hero: newHero('Hero', 'knight'),
  dungeon: newDungeon(),
  dragon: null,
  records: {},
  settings: { sound: true, ambience: true, haptics: true, graphics: 'full', use24h: false },
  active: null,
  lastOutcome: null,
  lastSettledDay: null,
  notices: [],
});

const storage = createJSONStorage(() => localStorage);

export const useGame = create<GameState>()(
  persist(initialGameState, {
    name: 'ironwyrm.game',
    storage,
    version: 1,
  }),
);

export interface HistoryState {
  sessions: WorkoutSession[];
  weighIns: WeighIn[];
  checkIns: CheckIn[];
}

export const initialHistoryState = (): HistoryState => ({ sessions: [], weighIns: [], checkIns: [] });

/** Long-lived history lives in its own store so per-set saves stay small. */
export const useHistory = create<HistoryState>()(
  persist(initialHistoryState, {
    name: 'ironwyrm.history',
    storage,
    version: 1,
  }),
);
