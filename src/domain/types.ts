/**
 * Core domain types. Everything in `src/domain` is pure TypeScript with no
 * React Native imports so it can be unit tested in isolation.
 *
 * Units: all loads are stored in kilograms, all durations in seconds unless a
 * field name says otherwise (`*At` fields are epoch milliseconds).
 */

/** Local calendar day in `YYYY-MM-DD` form. */
export type DayKey = string;

/** 0 = Sunday ... 6 = Saturday (matches `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Focus = 'grow' | 'fit' | 'lean';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Sex = 'male' | 'female' | 'unspecified';
export type WeightUnit = 'kg' | 'lb';

export type EquipmentId =
  | 'barbell'
  | 'rack'
  | 'bench'
  | 'dumbbells'
  | 'kettlebell'
  | 'cable'
  | 'machines'
  | 'pullup_bar'
  | 'dip_bars'
  | 'bands'
  | 'cardio';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hip_ext'
  | 'knee_flex'
  | 'knee_ext'
  | 'h_push'
  | 'v_push'
  | 'chest_fly'
  | 'h_pull'
  | 'v_pull'
  | 'lateral_raise'
  | 'rear_delt'
  | 'elbow_flex'
  | 'elbow_ext'
  | 'calf'
  | 'core'
  | 'conditioning'
  | 'mobility';

export type ExerciseKind = 'compound' | 'isolation' | 'conditioning' | 'mobility';

/** `reps` exercises log repetitions; `time` exercises log seconds held or worked. */
export type Measure = 'reps' | 'time';

export type JointArea = 'shoulder' | 'elbow' | 'wrist' | 'lower_back' | 'hip' | 'knee' | 'ankle';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  kind: ExerciseKind;
  measure: Measure;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  /** Every piece of equipment listed is required. Empty = bodyweight only. */
  equipment: EquipmentId[];
  /**
   * Fraction of body weight moved per rep. Used to estimate training load for
   * body weight work (a push-up moves roughly 64% of body weight).
   */
  bodyweightFactor: number;
  /** Whether the logged weight is external load (true) or optional added load (false). */
  externalLoad: boolean;
  region: 'upper' | 'lower' | 'full' | 'core';
  /** Joints this movement loads heavily, used when the lifter reports pain. */
  joints: JointArea[];
  /** 1 = easy to learn, 3 = technical. */
  skill: 1 | 2 | 3;
  cue: string;
}

export interface PlannedExercise {
  /** Stable slot id within a program day. */
  id: string;
  exerciseId: string;
  sets: number;
  /** Rep range, or seconds for `time` exercises. */
  repMin: number;
  repMax: number;
  restSec: number;
}

export interface ProgramDay {
  id: string;
  name: string;
  /** Short label such as "Push" or "Full body". */
  label: string;
  exercises: PlannedExercise[];
}

export type SplitId = 'full_body' | 'upper_lower' | 'ppl' | 'ppl_ul';

export interface Program {
  id: string;
  split: SplitId;
  focus: Focus;
  days: ProgramDay[];
  createdAt: number;
}

export interface SetLog {
  id: string;
  /** Repetitions, or seconds for `time` exercises. */
  reps: number;
  /** External or added load in kg. 0 for unloaded body weight work. */
  weight: number;
  /** Epoch ms when the lifter pressed Start. Equal to `endedAt` for quick logs. */
  startedAt: number;
  endedAt: number;
  /** True when the set was logged without the timer, so duration is unknown. */
  untimed?: boolean;
  rpe?: number;
  isBoss?: boolean;
}

export interface SessionExercise {
  slotId: string;
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  /** Suggested working weight in kg, if the app had enough history. */
  targetWeight?: number;
  sets: SetLog[];
  swappedFrom?: string;
  note?: string;
}

export type SessionLocation = 'gym' | 'home';
export type SessionKind = 'standard' | 'recovery';

export interface WorkoutSession {
  id: string;
  dayKey: DayKey;
  programDayId: string | null;
  title: string;
  location: SessionLocation;
  kind: SessionKind;
  /** True when the day was a scheduled training day (not a rest day). */
  scheduled: boolean;
  startedAt: number;
  endedAt?: number;
  bodyweightKg: number;
  exercises: SessionExercise[];
  readinessScore?: number;
  adjustments?: string[];
  bossAttempt?: BossAttempt;
}

export interface BossAttempt {
  bossId: string;
  challenge: BossChallenge;
  success?: boolean;
}

export type StatKey = 'str' | 'end' | 'agi' | 'vit';
export type Stats = Record<StatKey, number>;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type GearSlot = 'weapon' | 'helm' | 'armor' | 'boots' | 'relic';

export interface ItemBonus {
  stat?: StatKey;
  amount?: number;
  /** Extra XP as a whole-number percentage. */
  xpPct?: number;
  /** Extra gold as a whole-number percentage. */
  goldPct?: number;
}

export interface Item {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  power: number;
  bonus: ItemBonus;
  foundOn: DayKey;
  /** Where it dropped, for flavor ("Floor 4 chest"). */
  source: string;
}

export type HeroClass = 'knight' | 'barbarian' | 'mage' | 'rogue';

export interface Hero {
  name: string;
  heroClass: HeroClass;
  level: number;
  /** XP earned inside the current level. */
  xp: number;
  totalXp: number;
  gold: number;
  stats: Stats;
  inventory: Item[];
  equipped: Partial<Record<GearSlot, string>>;
  potions: { resolve: number; insight: number };
  /** Next workout earns +25% XP when true. */
  insightActive: boolean;
  titles: string[];
  activeTitle: string | null;
  streak: Streak;
  pity: { sinceRare: number; sinceEpic: number };
  /** Body weight milestones already rewarded for the current goal. */
  weightMilestones: number;
  /** Lifetime recovery check-ins, for Vitality. */
  checkIns: number;
}

export interface Streak {
  current: number;
  best: number;
  /** Last scheduled day that has been evaluated (completed, shielded or missed). */
  lastEvaluated: DayKey | null;
}

export type BossKind = 'reps' | 'weight' | 'hold';

export interface BossChallenge {
  exerciseId: string;
  kind: BossKind;
  /** Load in kg (0 for unloaded body weight work). */
  weight: number;
  /** Reps, or seconds for holds. */
  target: number;
}

export interface BossState {
  id: string;
  name: string;
  floor: number;
  challenge: BossChallenge;
  /** ISO week (`YYYY-Www`) the challenge was generated for. */
  week: string;
  lastAttemptWeek: string | null;
  attempts: number;
}

export interface JournalEntry {
  id: string;
  dayKey: DayKey;
  kind: 'room' | 'gate' | 'descend' | 'boss' | 'loot' | 'pr' | 'level' | 'dragon' | 'streak' | 'weight';
  text: string;
}

export interface DungeonState {
  floor: number;
  roomsCleared: number;
  /** PR sigils earned since arriving on this floor. */
  sigils: number;
  boss: BossState | null;
  bossesDefeated: string[];
  journal: JournalEntry[];
}

export type GoalKind = 'bodyweight' | 'lift' | 'sessions';

export interface Goal {
  kind: GoalKind;
  start: number;
  target: number;
  /** Required for `lift` goals: the estimated one-rep max is tracked. */
  exerciseId?: string;
  createdAt: number;
}

export interface DragonState {
  tier: number;
  name: string;
  epithet: string;
  goal: Goal;
  slain: boolean;
  /** Best progress fraction seen, so phase lines only fire once. */
  bestProgress: number;
}

export interface WeighIn {
  dayKey: DayKey;
  kg: number;
  at: number;
}

export interface ReadinessInput {
  sleepHours: number;
  /** 1 = very poor, 5 = excellent. */
  sleepQuality: number;
  /** 1 = exhausted, 5 = full of energy. */
  energy: number;
  /** 1 = calm, 5 = very stressed. */
  stress: number;
  /** 0 = none, 1 = mild, 2 = moderate, 3 = severe. */
  soreness: Partial<Record<MuscleGroup, 0 | 1 | 2 | 3>>;
  pain: JointArea[];
}

export interface CheckIn extends ReadinessInput {
  dayKey: DayKey;
  at: number;
  score: number;
}

export interface Profile {
  name: string;
  sex: Sex;
  birthYear: number | null;
  heightCm: number | null;
  unit: WeightUnit;
  experience: Experience;
  focus: Focus;
  gymEquipment: EquipmentId[];
  homeEquipment: EquipmentId[];
}

export interface ClockTime {
  hour: number;
  minute: number;
}

export interface Schedule {
  /** Index by `Weekday`; true = training day. */
  trainingDays: boolean[];
  reminderTime: ClockTime;
  remindersEnabled: boolean;
  /** One-off moves for a single day: train at another time, or rest instead. */
  overrides: Record<DayKey, ClockTime | 'rest' | 'train'>;
}
