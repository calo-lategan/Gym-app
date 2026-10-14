import { dayKeyOf, isoWeekKey } from '@/domain/dates';
import { findExercise, getExercise } from '@/domain/exercises';
import { canAttemptBoss, createBoss, refreshBossForWeek } from '@/domain/game/boss';
import { crossedPhases, goalProgress, newDragon } from '@/domain/game/dragon';
import { appendJournal, journalEntry } from '@/domain/game/dungeon';
import { generateItem } from '@/domain/game/loot';
import { addXp, autoEquip, buy, equip, newHero, salvage, type ShopItem } from '@/domain/game/progression';
import { resolveWorkout } from '@/domain/game/rewards';
import { settleStreak } from '@/domain/game/streak';
import { resolveCheckIn, resolveWeighIn } from '@/domain/game/weighin';
import { BALANCE } from '@/domain/game/balance';
import { generateProgram, homeVersionOfDay, recoveryDay } from '@/domain/program';
import { adjustPlanForReadiness, type ReadinessResult } from '@/domain/readiness';
import { applySet, dedupePrs, prsForNewSet, type ExerciseRecord, type PrEvent } from '@/domain/records';
import { swapRestDay } from '@/domain/reminders';
import { createRng, uid } from '@/domain/rng';
import { isTrainingDay, pruneOverrides, trainingDaysPerWeek } from '@/domain/schedule';
import { averageWeight } from '@/domain/science';
import { roundLoad, suggestNextTarget, suggestStartingLoad } from '@/domain/strength';
import type {
  ClockTime,
  EquipmentId,
  Experience,
  Focus,
  Goal,
  GoalKind,
  HeroClass,
  ProgramDay,
  ReadinessInput,
  SessionExercise,
  SessionLocation,
  SetLog,
  Sex,
  WeightUnit,
  WorkoutSession,
} from '@/domain/types';

import { parseBackup, serializeBackup } from './backup';
import { initialGameState, initialHistoryState, useGame, useHistory, type ActiveWorkout, type Settings, type StoredOutcome } from './stores';

const today = () => dayKeyOf(new Date());

// ── Derived reads ─────────────────────────────────────────────────

export function latestBodyweight(): number {
  const { weighIns } = useHistory.getState();
  return weighIns.length > 0 ? weighIns[weighIns.length - 1].kg : 75;
}

/** Current value the dragon's goal is measured against. */
export function goalCurrentValue(goal: Goal): number | null {
  const { weighIns, sessions } = useHistory.getState();
  const { records } = useGame.getState();
  switch (goal.kind) {
    case 'bodyweight':
      return averageWeight(weighIns, today()) ?? (weighIns.length ? weighIns[weighIns.length - 1].kg : null);
    case 'lift':
      return goal.exerciseId ? (records[goal.exerciseId]?.bestE1rm ?? null) : null;
    case 'sessions':
      return sessions.filter((s) => s.endedAt && s.startedAt >= goal.createdAt).length;
  }
}

export function completedDays(scheduledOnly = true): Set<string> {
  return new Set(
    useHistory
      .getState()
      .sessions.filter((s) => s.endedAt && (!scheduledOnly || s.scheduled))
      .map((s) => s.dayKey),
  );
}

export function todaysProgramDay(): ProgramDay | null {
  const { program, nextDayIndex } = useGame.getState();
  if (!program || program.days.length === 0) return null;
  return program.days[nextDayIndex % program.days.length];
}

// ── Onboarding ────────────────────────────────────────────────────

export interface OnboardingInput {
  name: string;
  heroClass: HeroClass;
  focus: Focus;
  experience: Experience;
  sex: Sex;
  unit: WeightUnit;
  bodyweightKg: number;
  heightCm: number | null;
  birthYear: number | null;
  trainingDays: boolean[];
  reminderTime: ClockTime;
  gymEquipment: EquipmentId[];
  homeEquipment: EquipmentId[];
  goal: { kind: GoalKind; target: number; start?: number; exerciseId?: string };
}

export function completeOnboarding(input: OnboardingInput) {
  const now = Date.now();
  const schedule = {
    trainingDays: input.trainingDays,
    reminderTime: input.reminderTime,
    remindersEnabled: true,
    overrides: {},
  };
  const program = generateProgram({
    focus: input.focus,
    experience: input.experience,
    daysPerWeek: Math.max(1, trainingDaysPerWeek(schedule)),
    equipment: input.gymEquipment,
  });
  const start = input.goal.kind === 'bodyweight' ? input.bodyweightKg : input.goal.kind === 'sessions' ? 0 : (input.goal.start ?? 0);
  const goal: Goal = { kind: input.goal.kind, start, target: input.goal.target, exerciseId: input.goal.exerciseId, createdAt: now };
  const hero = {
    ...newHero(input.name.trim() || 'Hero', input.heroClass),
    streak: { current: 0, best: 0, lastEvaluated: dayKeyOf(now - 86_400_000) },
  };
  const yesterdayKey = dayKeyOf(now - 86_400_000);

  useGame.setState({
    onboarded: true,
    profile: {
      name: input.name.trim() || 'Hero',
      sex: input.sex,
      birthYear: input.birthYear,
      heightCm: input.heightCm,
      unit: input.unit,
      experience: input.experience,
      focus: input.focus,
      gymEquipment: input.gymEquipment,
      homeEquipment: input.homeEquipment,
    },
    schedule,
    program,
    nextDayIndex: 0,
    hero,
    dragon: newDragon(goal),
    lastSettledDay: yesterdayKey,
  });
  useHistory.setState({
    weighIns: [{ dayKey: today(), kg: input.bodyweightKg, at: now }],
  });
}

// ── Daily upkeep ──────────────────────────────────────────────────

/** Run when the app becomes active: settles streaks, tidies overrides, refreshes the weekly boss. */
export function settleDaily(): string[] {
  const state = useGame.getState();
  if (!state.onboarded) return [];
  const day = today();
  const notices: string[] = [];
  const { hero, events } = settleStreak(state.hero, state.schedule, completedDays(), day);
  for (const event of events) {
    if (event.type === 'shield_used') notices.push('A Potion of Resolve kept your streak alive through a missed day.');
    if (event.type === 'streak_lost') notices.push(`Your ${event.lost}-day streak went cold. Light it again today.`);
  }
  let dungeon = state.dungeon;
  if (dungeon.boss && state.program) {
    const week = isoWeekKey(day);
    if (dungeon.boss.week !== week) {
      dungeon = { ...dungeon, boss: refreshBossForWeek(dungeon.boss, week, state.program, state.records, state.profile.unit) };
      notices.push(`${dungeon.boss!.name} has returned for a new week. You get one challenge.`);
    }
  }
  useGame.setState({
    hero,
    dungeon,
    schedule: pruneOverrides(state.schedule, day),
    lastSettledDay: day,
    notices: [...state.notices, ...notices],
  });
  return notices;
}

export function dismissNotices() {
  useGame.setState({ notices: [] });
}

// ── Workouts ──────────────────────────────────────────────────────

export interface StartWorkoutOptions {
  location: SessionLocation;
  recovery?: boolean;
  readiness?: { input: ReadinessInput; result: ReadinessResult } | null;
  applyAdjustments?: boolean;
  bossAttempt?: boolean;
}

function lastSetsFor(exerciseId: string): SetLog[] {
  const sessions = useHistory.getState().sessions;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const found = sessions[i].exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (found) return found.sets.filter((s) => !s.isBoss);
  }
  return [];
}

function targetFor(exerciseId: string, repMin: number, repMax: number, loadFactor: number): number | undefined {
  const { profile } = useGame.getState();
  const exercise = getExercise(exerciseId);
  if (!exercise.externalLoad) return 0;
  const next = suggestNextTarget(exercise, lastSetsFor(exerciseId), repMin, repMax, profile.unit);
  const base = next?.weight ?? suggestStartingLoad(exercise, latestBodyweight(), profile.experience, profile.sex, profile.unit);
  if (base === undefined) return undefined;
  return loadFactor < 1 ? roundLoad(base * loadFactor, exercise, profile.unit) : base;
}

export function previewDay(options: StartWorkoutOptions): { day: ProgramDay; changes: string[]; loadFactor: number; extraRestSec: number } | null {
  const state = useGame.getState();
  const base = options.recovery ? recoveryDay() : todaysProgramDay();
  if (!base) return null;
  const equipment = options.location === 'home' ? state.profile.homeEquipment : state.profile.gymEquipment;
  let day = options.location === 'home' && !options.recovery ? homeVersionOfDay(base, state.profile.homeEquipment) : base;
  let changes: string[] = [];
  let loadFactor = 1;
  let extraRestSec = 0;
  if (options.readiness && options.applyAdjustments && !options.recovery) {
    const adjusted = adjustPlanForReadiness(day, options.readiness.input, options.readiness.result, equipment);
    day = adjusted.day;
    changes = adjusted.changes;
    loadFactor = adjusted.loadFactor;
    extraRestSec = adjusted.extraRestSec;
  }
  return { day, changes, loadFactor, extraRestSec };
}

export function startWorkout(options: StartWorkoutOptions): boolean {
  const state = useGame.getState();
  const preview = previewDay(options);
  if (!preview) return false;
  const { day, changes, loadFactor, extraRestSec } = preview;
  const now = Date.now();
  const dayKey = today();

  const exercises: SessionExercise[] = day.exercises.map((planned) => ({
    slotId: planned.id,
    exerciseId: planned.exerciseId,
    targetSets: planned.sets,
    repMin: planned.repMin,
    repMax: planned.repMax,
    restSec: planned.restSec + extraRestSec,
    targetWeight: targetFor(planned.exerciseId, planned.repMin, planned.repMax, loadFactor),
    sets: [],
  }));

  let bossIndex: number | null = null;
  const week = isoWeekKey(dayKey);
  const boss = state.dungeon.boss;
  let bossAttempt: WorkoutSession['bossAttempt'];
  if (options.bossAttempt && boss && canAttemptBoss(boss, week)) {
    const challenge = boss.challenge;
    exercises.push({
      slotId: 'boss',
      exerciseId: challenge.exerciseId,
      targetSets: 1,
      repMin: challenge.target,
      repMax: challenge.target,
      restSec: 180,
      targetWeight: challenge.weight,
      sets: [],
      note: `Miniboss: ${boss.name}`,
    });
    bossIndex = exercises.length - 1;
    bossAttempt = { bossId: boss.id, challenge };
  }

  const session: WorkoutSession = {
    id: uid('ses_'),
    dayKey,
    programDayId: options.recovery ? null : day.id,
    title: day.name,
    location: options.location,
    kind: options.recovery ? 'recovery' : 'standard',
    scheduled: isTrainingDay(state.schedule, dayKey),
    startedAt: now,
    bodyweightKg: latestBodyweight(),
    exercises,
    readinessScore: options.readiness?.result.score,
    adjustments: changes,
    bossAttempt,
  };

  const active: ActiveWorkout = {
    session,
    current: 0,
    running: null,
    restEndsAt: null,
    restTotalSec: 0,
    livePrs: [],
    changes,
    recordsAtStart: state.records,
    bossIndex,
  };
  useGame.setState({ active });
  return true;
}

function updateActive(fn: (active: ActiveWorkout) => ActiveWorkout) {
  const active = useGame.getState().active;
  if (active) useGame.setState({ active: fn(active) });
}

export function selectExercise(index: number) {
  updateActive((a) => ({ ...a, current: index }));
}

export function startSet() {
  updateActive((a) => ({ ...a, running: { exerciseIndex: a.current, startedAt: Date.now() }, restEndsAt: null }));
}

export function cancelSet() {
  updateActive((a) => ({ ...a, running: null }));
}

export interface LoggedSetResult {
  set: SetLog;
  prs: PrEvent[];
  exerciseDone: boolean;
  workoutDone: boolean;
  bossHit: boolean;
  bossDefeated: boolean;
  restSec: number;
}

export function logSet(entry: { reps: number; weight: number; rpe?: number }): LoggedSetResult | null {
  const state = useGame.getState();
  const active = state.active;
  if (!active) return null;
  const index = active.running?.exerciseIndex ?? active.current;
  const ex = active.session.exercises[index];
  const exercise = findExercise(ex.exerciseId);
  if (!exercise) return null;
  const now = Date.now();
  const isBoss = active.bossIndex === index;
  const set: SetLog = {
    id: uid('set_'),
    reps: Math.max(0, Math.round(entry.reps)),
    weight: Math.max(0, entry.weight),
    startedAt: active.running ? active.running.startedAt : now,
    endedAt: now,
    untimed: active.running ? undefined : true,
    rpe: entry.rpe,
    isBoss: isBoss || undefined,
  };
  const earlier = active.session.exercises.filter((e) => e.exerciseId === ex.exerciseId).flatMap((e) => e.sets);
  const prs = prsForNewSet(active.recordsAtStart[ex.exerciseId], earlier, set, exercise, active.session.dayKey);

  const exercises = active.session.exercises.map((e, i) => (i === index ? { ...e, sets: [...e.sets, set] } : e));
  const exerciseDone = exercises[index].sets.length >= exercises[index].targetSets;
  const workoutDone = exerciseDone && exercises.every((e) => e.sets.length >= e.targetSets);
  const nextCurrent = exerciseDone ? nextIndexAfter(exercises, index) : index;
  const restSec = workoutDone ? 0 : ex.restSec;
  const bossDefeated =
    isBoss &&
    Boolean(active.session.bossAttempt) &&
    set.reps >= active.session.bossAttempt!.challenge.target &&
    set.weight >= active.session.bossAttempt!.challenge.weight - 0.01;

  useGame.setState({
    active: {
      ...active,
      session: { ...active.session, exercises },
      current: nextCurrent,
      running: null,
      restEndsAt: restSec > 0 ? now + restSec * 1000 : null,
      restTotalSec: restSec,
      livePrs: [...active.livePrs, ...prs],
    },
  });
  return { set, prs, exerciseDone, workoutDone, bossHit: isBoss, bossDefeated, restSec };
}

function nextIndexAfter(exercises: SessionExercise[], index: number): number {
  for (let step = 1; step <= exercises.length; step++) {
    const i = (index + step) % exercises.length;
    if (exercises[i].sets.length < exercises[i].targetSets) return i;
  }
  return index;
}

export function skipRest() {
  updateActive((a) => ({ ...a, restEndsAt: null }));
}

export function extendRest(seconds: number) {
  updateActive((a) => ({
    ...a,
    restEndsAt: (a.restEndsAt ?? Date.now()) + seconds * 1000,
    restTotalSec: a.restTotalSec + seconds,
  }));
}

export function editSet(exerciseIndex: number, setId: string, patch: Partial<Pick<SetLog, 'reps' | 'weight'>>) {
  updateActive((a) => ({
    ...a,
    session: {
      ...a.session,
      exercises: a.session.exercises.map((e, i) =>
        i === exerciseIndex ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : e,
      ),
    },
    livePrs: a.livePrs.filter((p) => p.setId !== setId),
  }));
}

export function deleteSet(exerciseIndex: number, setId: string) {
  updateActive((a) => ({
    ...a,
    session: {
      ...a.session,
      exercises: a.session.exercises.map((e, i) => (i === exerciseIndex ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e)),
    },
    livePrs: a.livePrs.filter((p) => p.setId !== setId),
  }));
}

export function adjustTargetSets(exerciseIndex: number, delta: number) {
  updateActive((a) => ({
    ...a,
    session: {
      ...a.session,
      exercises: a.session.exercises.map((e, i) =>
        i === exerciseIndex ? { ...e, targetSets: Math.max(Math.max(1, e.sets.length), e.targetSets + delta) } : e,
      ),
    },
  }));
}

/**
 * Swap an exercise in the running workout. When `permanent` is set, the plan
 * is updated too, and any equipment the lifter said they lack is removed from
 * their equipment list so future plans avoid it.
 */
export function swapExercise(exerciseIndex: number, newExerciseId: string, options: { permanent?: boolean; missingEquipment?: EquipmentId[] } = {}) {
  const state = useGame.getState();
  const active = state.active;
  if (!active) return;
  const ex = active.session.exercises[exerciseIndex];
  const newExercise = getExercise(newExerciseId);
  const exercises = active.session.exercises.map((e, i) =>
    i === exerciseIndex
      ? {
          ...e,
          exerciseId: newExerciseId,
          swappedFrom: e.swappedFrom ?? e.exerciseId,
          sets: [],
          targetWeight: targetFor(newExerciseId, e.repMin, e.repMax, 1),
          repMin: newExercise.measure === 'time' ? Math.max(e.repMin, 20) : e.repMin,
          repMax: newExercise.measure === 'time' ? Math.max(e.repMax, 40) : e.repMax,
        }
      : e,
  );
  useGame.setState({ active: { ...active, session: { ...active.session, exercises } } });

  if (options.missingEquipment?.length) {
    const key = active.session.location === 'home' ? 'homeEquipment' : 'gymEquipment';
    const profile = useGame.getState().profile;
    useGame.setState({
      profile: { ...profile, [key]: profile[key].filter((q) => !options.missingEquipment!.includes(q)) },
    });
  }
  if (options.permanent && active.session.programDayId && active.session.location === 'gym') {
    replaceInProgram(active.session.programDayId, ex.slotId, newExerciseId);
  }
}

export function addExerciseToWorkout(exerciseId: string) {
  updateActive((a) => {
    const exercise = getExercise(exerciseId);
    const timed = exercise.measure === 'time';
    const entry: SessionExercise = {
      slotId: uid('extra_'),
      exerciseId,
      targetSets: 3,
      repMin: timed ? 30 : 8,
      repMax: timed ? 45 : 12,
      restSec: 75,
      targetWeight: targetFor(exerciseId, 8, 12, 1),
      sets: [],
    };
    const exercises = [...a.session.exercises];
    const insertAt = a.bossIndex !== null ? a.bossIndex : exercises.length;
    exercises.splice(insertAt, 0, entry);
    return {
      ...a,
      bossIndex: a.bossIndex !== null ? a.bossIndex + 1 : null,
      session: { ...a.session, exercises },
      current: insertAt,
    };
  });
}

export function removeExerciseFromWorkout(index: number) {
  updateActive((a) => {
    if (a.session.exercises.length <= 1) return a;
    const exercises = a.session.exercises.filter((_, i) => i !== index);
    let bossIndex = a.bossIndex;
    if (bossIndex !== null) bossIndex = index === bossIndex ? null : index < bossIndex ? bossIndex - 1 : bossIndex;
    return {
      ...a,
      bossIndex,
      session: {
        ...a.session,
        exercises,
        bossAttempt: bossIndex === null ? undefined : a.session.bossAttempt,
      },
      current: Math.min(a.current, exercises.length - 1),
    };
  });
}

export function discardWorkout() {
  useGame.setState({ active: null });
}

export function finishWorkout(): StoredOutcome | null {
  const state = useGame.getState();
  const active = state.active;
  if (!active) return null;
  const now = Date.now();
  const dayKey = active.session.dayKey;
  const session: WorkoutSession = { ...active.session, endedAt: now };
  const unit = state.profile.unit;

  // Records after this session.
  const records: Record<string, ExerciseRecord> = { ...state.records };
  for (const ex of session.exercises) {
    const exercise = findExercise(ex.exerciseId);
    if (!exercise) continue;
    for (const set of ex.sets) records[ex.exerciseId] = applySet(records[ex.exerciseId], set, exercise, dayKey);
  }
  const prs = dedupePrs(active.livePrs);

  const history = useHistory.getState();
  const firstScheduledToday = !history.sessions.some((s) => s.dayKey === dayKey && s.scheduled && s.endedAt);
  const week = isoWeekKey(dayKey);
  const program = state.program;

  const outcome = resolveWorkout({
    state: {
      hero: state.hero,
      dungeon: state.dungeon,
      dragon: state.dragon ?? newDragon({ kind: 'sessions', start: 0, target: 40, createdAt: now }),
    },
    session,
    prs,
    today: dayKey,
    createBoss: (floor) => (program ? createBoss(floor, week, program, records, unit) : null),
    firstScheduledToday,
  });

  let dungeon = outcome.state.dungeon;
  if (session.bossAttempt && dungeon.boss && session.exercises.some((e) => e.sets.some((s) => s.isBoss))) {
    dungeon = { ...dungeon, boss: { ...dungeon.boss, lastAttemptWeek: week } };
  }

  useHistory.setState({ sessions: [...history.sessions, session] });

  // Dragon progress can move after a workout for strength and session goals.
  let dragon = state.dragon;
  let dragonSummary: StoredOutcome['dragon'] = null;
  if (dragon) {
    const before = goalProgress(dragon.goal, dragonCurrentBefore(dragon.goal, records));
    useGame.setState({ records });
    const after = goalProgress(dragon.goal, goalCurrentValue(dragon.goal));
    const lines = crossedPhases(dragon.bestProgress, after).map((p) => p.line);
    dragon = { ...dragon, bestProgress: Math.max(dragon.bestProgress, after) };
    dragonSummary = { before, after, lines };
    if (lines.length)
      dungeon = appendJournal(
        dungeon,
        lines.map((l) => journalEntry(dayKey, 'dragon', l)),
      );
  }

  const nextDayIndex =
    session.programDayId && session.kind === 'standard' && program ? (state.nextDayIndex + 1) % program.days.length : state.nextDayIndex;

  const stored: StoredOutcome = {
    sessionId: session.id,
    title: session.title,
    completed: outcome.completed,
    completedSets: outcome.completedSets,
    plannedSets: outcome.plannedSets,
    setsNeeded: outcome.setsNeeded,
    durationSec: Math.round((now - session.startedAt) / 1000),
    xp: outcome.xp,
    gold: outcome.gold,
    statGains: outcome.statGains,
    levelBefore: outcome.levelBefore,
    xpBefore: state.hero.xp,
    levelAfter: outcome.state.hero.level,
    levelsGained: outcome.levelsGained,
    prs: outcome.prs,
    loot: outcome.loot,
    dungeonEvents: outcome.dungeonEvents,
    boss: outcome.boss,
    streak: outcome.streak,
    floorBefore: state.dungeon.floor,
    floorAfter: dungeon.floor,
    dragon: dragonSummary,
    heroClass: state.hero.heroClass,
  };

  useGame.setState({
    hero: outcome.state.hero,
    dungeon,
    dragon,
    records,
    nextDayIndex,
    active: null,
    lastOutcome: stored,
  });
  return stored;
}

/** Goal value as it stood before this session's records were saved. */
function dragonCurrentBefore(goal: Goal, _newRecords: Record<string, ExerciseRecord>): number | null {
  const state = useGame.getState();
  if (goal.kind === 'lift') return goal.exerciseId ? (state.records[goal.exerciseId]?.bestE1rm ?? null) : null;
  if (goal.kind === 'sessions') {
    const value = goalCurrentValue(goal);
    return value === null ? null : Math.max(0, value - 1);
  }
  return goalCurrentValue(goal);
}

// ── Body weight and recovery ─────────────────────────────────────

export function logWeighIn(kg: number) {
  const state = useGame.getState();
  const history = useHistory.getState();
  const day = today();
  const firstToday = !history.weighIns.some((w) => w.dayKey === day);
  const weighIns = [...history.weighIns.filter((w) => w.dayKey !== day), { dayKey: day, kg, at: Date.now() }].sort((a, b) => a.at - b.at);
  useHistory.setState({ weighIns });

  if (!state.dragon) return null;
  const outcome = resolveWeighIn(state.hero, state.dragon.goal, weighIns, day, firstToday);
  const progress = goalProgress(state.dragon.goal, goalCurrentValue(state.dragon.goal));
  const lines = crossedPhases(state.dragon.bestProgress, progress).map((p) => p.line);
  let dungeon = state.dungeon;
  if (outcome.newMilestones > 0) {
    dungeon = appendJournal(dungeon, [journalEntry(day, 'weight', `Body weight milestone reached. Vitality +${outcome.newMilestones}.`)]);
  }
  if (lines.length)
    dungeon = appendJournal(
      dungeon,
      lines.map((l) => journalEntry(day, 'dragon', l)),
    );
  useGame.setState({
    hero: outcome.hero,
    dungeon,
    dragon: { ...state.dragon, bestProgress: Math.max(state.dragon.bestProgress, progress) },
  });
  return { ...outcome, progress, lines };
}

export function submitCheckIn(input: ReadinessInput, result: ReadinessResult) {
  const state = useGame.getState();
  const history = useHistory.getState();
  const day = today();
  const firstToday = !history.checkIns.some((c) => c.dayKey === day);
  useHistory.setState({
    checkIns: [...history.checkIns.filter((c) => c.dayKey !== day), { ...input, dayKey: day, at: Date.now(), score: result.score }].slice(-120),
  });
  const outcome = resolveCheckIn(state.hero, firstToday);
  useGame.setState({ hero: outcome.hero });
  return outcome;
}

// ── Dragon ───────────────────────────────────────────────────────

export function slayDragon(nextGoal: { kind: GoalKind; target: number; start?: number; exerciseId?: string }) {
  const state = useGame.getState();
  if (!state.dragon) return null;
  const day = today();
  const rng = createRng(Date.now() % 100000);
  let hero = addXp(state.hero, BALANCE.xp.dragonSlain).hero;
  const item = generateItem(rng, 'legendary', hero.heroClass, state.dungeon.floor, day, `Hoard of ${state.dragon.name}`, 'weapon');
  hero = { ...hero, inventory: [item, ...hero.inventory] };
  hero = autoEquip(hero, item).hero;
  const title = state.dragon.tier === 1 ? 'Dragonslayer' : `Slayer of ${state.dragon.name}`;
  hero = { ...hero, titles: [...new Set([...hero.titles, title])], activeTitle: title, gold: hero.gold + 500, weightMilestones: 0 };
  const start = nextGoal.kind === 'bodyweight' ? latestBodyweight() : nextGoal.kind === 'sessions' ? 0 : (nextGoal.start ?? 0);
  const goal: Goal = { kind: nextGoal.kind, start, target: nextGoal.target, exerciseId: nextGoal.exerciseId, createdAt: Date.now() };
  const dungeon = appendJournal(state.dungeon, [journalEntry(day, 'dragon', `${state.dragon.name} ${state.dragon.epithet} has fallen.`)]);
  useGame.setState({ hero, dungeon, dragon: newDragon(goal, state.dragon.tier + 1) });
  return { item, title };
}

export function setGoal(next: { kind: GoalKind; target: number; start?: number; exerciseId?: string }) {
  const state = useGame.getState();
  const start = next.kind === 'bodyweight' ? latestBodyweight() : next.kind === 'sessions' ? 0 : (next.start ?? 0);
  const goal: Goal = { kind: next.kind, start, target: next.target, exerciseId: next.exerciseId, createdAt: Date.now() };
  useGame.setState({
    dragon: newDragon(goal, state.dragon?.tier ?? 1),
    hero: { ...state.hero, weightMilestones: 0 },
  });
}

// ── Schedule ─────────────────────────────────────────────────────

export function setTrainingDay(weekday: number, training: boolean) {
  const state = useGame.getState();
  const trainingDays = state.schedule.trainingDays.map((d, i) => (i === weekday ? training : d));
  useGame.setState({ schedule: { ...state.schedule, trainingDays } });
}

export function setReminderTime(time: ClockTime) {
  const state = useGame.getState();
  useGame.setState({ schedule: { ...state.schedule, reminderTime: time } });
}

export function setRemindersEnabled(enabled: boolean) {
  const state = useGame.getState();
  useGame.setState({ schedule: { ...state.schedule, remindersEnabled: enabled } });
}

export function moveSessionToday(time: ClockTime) {
  const state = useGame.getState();
  useGame.setState({ schedule: { ...state.schedule, overrides: { ...state.schedule.overrides, [today()]: time } } });
}

export function restToday() {
  const state = useGame.getState();
  useGame.setState({ schedule: swapRestDay(state.schedule, today()) });
}

export function trainToday() {
  const state = useGame.getState();
  useGame.setState({ schedule: { ...state.schedule, overrides: { ...state.schedule.overrides, [today()]: 'train' } } });
}

export function clearTodayOverride() {
  const state = useGame.getState();
  const overrides = { ...state.schedule.overrides };
  delete overrides[today()];
  useGame.setState({ schedule: { ...state.schedule, overrides } });
}

// ── Program editing ──────────────────────────────────────────────

function updateDay(dayId: string, fn: (day: ProgramDay) => ProgramDay) {
  const program = useGame.getState().program;
  if (!program) return;
  useGame.setState({ program: { ...program, days: program.days.map((d) => (d.id === dayId ? fn(d) : d)) } });
}

export function regenerateProgram() {
  const state = useGame.getState();
  useGame.setState({
    program: generateProgram({
      focus: state.profile.focus,
      experience: state.profile.experience,
      daysPerWeek: Math.max(1, trainingDaysPerWeek(state.schedule)),
      equipment: state.profile.gymEquipment,
    }),
    nextDayIndex: 0,
  });
}

export function replaceInProgram(dayId: string, slotId: string, exerciseId: string) {
  updateDay(dayId, (day) => ({
    ...day,
    exercises: day.exercises.map((e) => (e.id === slotId ? { ...e, exerciseId } : e)),
  }));
}

export function updatePlanned(dayId: string, slotId: string, patch: { sets?: number; repMin?: number; repMax?: number; restSec?: number }) {
  updateDay(dayId, (day) => ({
    ...day,
    exercises: day.exercises.map((e) => {
      if (e.id !== slotId) return e;
      const next = { ...e, ...patch };
      next.sets = Math.min(10, Math.max(1, next.sets));
      next.repMin = Math.max(1, next.repMin);
      next.repMax = Math.max(next.repMin, next.repMax);
      next.restSec = Math.min(600, Math.max(15, next.restSec));
      return next;
    }),
  }));
}

export function addToDay(dayId: string, exerciseId: string) {
  const timed = getExercise(exerciseId).measure === 'time';
  updateDay(dayId, (day) => ({
    ...day,
    exercises: [...day.exercises, { id: uid('slot_'), exerciseId, sets: 3, repMin: timed ? 30 : 8, repMax: timed ? 45 : 12, restSec: 75 }],
  }));
}

export function removeFromDay(dayId: string, slotId: string) {
  updateDay(dayId, (day) => ({ ...day, exercises: day.exercises.filter((e) => e.id !== slotId) }));
}

export function moveInDay(dayId: string, slotId: string, direction: -1 | 1) {
  updateDay(dayId, (day) => {
    const index = day.exercises.findIndex((e) => e.id === slotId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= day.exercises.length) return day;
    const exercises = [...day.exercises];
    [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
    return { ...day, exercises };
  });
}

export function setNextDay(index: number) {
  useGame.setState({ nextDayIndex: index });
}

// ── Profile, gear, settings ──────────────────────────────────────

export function updateProfile(patch: Partial<ReturnType<typeof useGame.getState>['profile']>) {
  useGame.setState({ profile: { ...useGame.getState().profile, ...patch } });
}

export function setEquipment(kind: 'gymEquipment' | 'homeEquipment', equipment: EquipmentId[]) {
  updateProfile({ [kind]: equipment });
}

export function buyItem(item: ShopItem): boolean {
  const next = buy(useGame.getState().hero, item);
  if (!next) return false;
  useGame.setState({ hero: next });
  return true;
}

export function drinkInsight(): boolean {
  const hero = useGame.getState().hero;
  if (hero.potions.insight <= 0 || hero.insightActive) return false;
  useGame.setState({ hero: { ...hero, insightActive: true, potions: { ...hero.potions, insight: hero.potions.insight - 1 } } });
  return true;
}

export function equipItem(itemId: string) {
  useGame.setState({ hero: equip(useGame.getState().hero, itemId) });
}

export function salvageItem(itemId: string) {
  useGame.setState({ hero: salvage(useGame.getState().hero, itemId) });
}

export function setActiveTitle(title: string) {
  const hero = useGame.getState().hero;
  if (hero.titles.includes(title)) useGame.setState({ hero: { ...hero, activeTitle: title } });
}

export function setHeroClass(heroClass: HeroClass) {
  useGame.setState({ hero: { ...useGame.getState().hero, heroClass } });
}

export function renameHero(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const state = useGame.getState();
  useGame.setState({ hero: { ...state.hero, name: trimmed }, profile: { ...state.profile, name: trimmed } });
}

export function updateSettings(patch: Partial<Settings>) {
  useGame.setState({ settings: { ...useGame.getState().settings, ...patch } });
}

export function exportData(): string {
  return serializeBackup(useGame.getState(), useHistory.getState());
}

/**
 * Replaces everything with a backup. Any workout in progress in the backup
 * is dropped, since it would be stale. Returns why nothing changed if the
 * file does not check out.
 */
export function restoreBackup(text: string): { ok: true; sessions: number } | { ok: false; reason: string } {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  useGame.setState({ ...initialGameState(), ...parsed.game, active: null, notices: [] });
  useHistory.setState({ ...initialHistoryState(), ...parsed.history });
  return { ok: true, sessions: parsed.history.sessions.length };
}

export function resetAll() {
  useGame.setState(initialGameState());
  useHistory.setState(initialHistoryState());
}

/** Double-progression suggestion for an exercise based on its most recent session. */
export function suggestionFor(exerciseId: string, repMin: number, repMax: number) {
  const exercise = findExercise(exerciseId);
  if (!exercise) return null;
  return suggestNextTarget(exercise, lastSetsFor(exerciseId), repMin, repMax, useGame.getState().profile.unit);
}

/** The sets from the most recent session that included this exercise. */
export function lastTimeFor(exerciseId: string): SetLog[] {
  return lastSetsFor(exerciseId);
}
