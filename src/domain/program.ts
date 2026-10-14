import { EXERCISE_BY_ID, getExercise, isAvailable } from './exercises';
import { uid } from './rng';
import { bestSubstitute } from './substitution';
import type { EquipmentId, Experience, Focus, Pattern, PlannedExercise, Program, ProgramDay, SplitId } from './types';

type Role = 'main' | 'secondary' | 'accessory' | 'core' | 'finisher';

interface Slot {
  pattern: Pattern;
  role: Role;
  /** Preferred exercises in order. The first available one wins. */
  prefer: string[];
}

interface DayTemplate {
  name: string;
  label: string;
  slots: Slot[];
}

const S = (pattern: Pattern, role: Role, ...prefer: string[]): Slot => ({ pattern, role, prefer });

const SQUAT_A = ['back_squat', 'leg_press', 'goblet_squat', 'kb_goblet_squat', 'band_squat', 'bodyweight_squat'];
const SQUAT_B = ['front_squat', 'hack_squat', 'leg_press', 'goblet_squat', 'kb_goblet_squat', 'tempo_squat'];
const HINGE_A = ['romanian_deadlift', 'db_romanian_deadlift', 'kb_swing', 'band_good_morning', 'single_leg_rdl'];
const HINGE_B = ['deadlift', 'db_romanian_deadlift', 'kb_swing', 'single_leg_rdl'];
const LUNGE = ['bulgarian_split_squat', 'db_lunge', 'bw_split_squat', 'reverse_lunge', 'step_up'];
const HPUSH_A = ['bench_press', 'db_bench_press', 'machine_chest_press', 'db_floor_press', 'push_up', 'band_chest_press'];
const HPUSH_B = ['incline_bench_press', 'db_incline_press', 'dip', 'machine_chest_press', 'decline_push_up', 'push_up'];
const VPUSH = ['overhead_press', 'db_shoulder_press', 'machine_shoulder_press', 'kb_press', 'band_overhead_press', 'pike_push_up'];
const VPUSH_DB = ['db_shoulder_press', 'machine_shoulder_press', 'kb_press', 'overhead_press', 'band_overhead_press', 'pike_push_up'];
const HPULL_A = ['barbell_row', 'db_row', 'seated_cable_row', 'machine_row', 'kb_row', 'inverted_row', 'band_row', 'table_row'];
const HPULL_B = ['seated_cable_row', 'machine_row', 'db_row', 'kb_row', 'inverted_row', 'band_row', 'table_row'];
const VPULL = ['pull_up', 'lat_pulldown', 'assisted_pull_up', 'chin_up', 'negative_pull_up', 'band_pulldown', 'towel_door_row'];
const VPULL_B = ['lat_pulldown', 'chin_up', 'assisted_pull_up', 'pull_up', 'band_pulldown', 'towel_door_row'];
const FLY = ['cable_fly', 'pec_deck', 'db_fly', 'band_fly', 'decline_push_up'];
const LATERAL = ['lateral_raise', 'cable_lateral_raise', 'band_lateral_raise', 'y_raise'];
const REAR = ['face_pull', 'rear_delt_fly', 'band_pull_apart', 'reverse_snow_angel'];
const CURL = ['db_curl', 'cable_curl', 'barbell_curl', 'kb_curl', 'band_curl', 'towel_curl'];
const HAMMER = ['hammer_curl', 'cable_curl', 'db_curl', 'band_curl', 'towel_curl'];
const TRI = ['cable_pushdown', 'overhead_db_extension', 'skull_crusher', 'band_pushdown', 'close_grip_push_up', 'chair_dip'];
const TRI_B = ['overhead_db_extension', 'skull_crusher', 'cable_pushdown', 'band_pushdown', 'chair_dip', 'close_grip_push_up'];
const HAM = ['leg_curl', 'band_leg_curl', 'nordic_curl', 'single_leg_glute_bridge'];
const QUAD_ISO = ['leg_extension', 'sissy_squat', 'tempo_squat'];
const GLUTE = ['hip_thrust', 'glute_bridge', 'single_leg_glute_bridge'];
const CALF = ['machine_calf_raise', 'db_calf_raise', 'calf_raise'];
const CORE_A = ['hanging_leg_raise', 'cable_crunch', 'dead_bug', 'bicycle_crunch'];
const CORE_B = ['plank', 'side_plank', 'hollow_hold'];
const CORE_C = ['pallof_press', 'dead_bug', 'bicycle_crunch'];

const TEMPLATES: Record<SplitId, DayTemplate[]> = {
  full_body: [
    {
      name: 'Full Body A',
      label: 'Full body',
      slots: [
        S('squat', 'main', ...SQUAT_A),
        S('h_push', 'main', ...HPUSH_A),
        S('h_pull', 'main', ...HPULL_A),
        S('hinge', 'secondary', ...HINGE_A),
        S('lateral_raise', 'accessory', ...LATERAL),
        S('core', 'core', ...CORE_B),
      ],
    },
    {
      name: 'Full Body B',
      label: 'Full body',
      slots: [
        S('hinge', 'main', ...HINGE_B),
        S('v_push', 'main', ...VPUSH),
        S('v_pull', 'main', ...VPULL),
        S('lunge', 'secondary', ...LUNGE),
        S('elbow_flex', 'accessory', ...CURL),
        S('elbow_ext', 'accessory', ...TRI),
      ],
    },
    {
      name: 'Full Body C',
      label: 'Full body',
      slots: [
        S('squat', 'main', ...SQUAT_B),
        S('h_push', 'main', ...HPUSH_B),
        S('h_pull', 'secondary', ...HPULL_B),
        S('hip_ext', 'secondary', ...GLUTE),
        S('rear_delt', 'accessory', ...REAR),
        S('calf', 'accessory', ...CALF),
        S('core', 'core', ...CORE_A),
      ],
    },
  ],
  upper_lower: [
    {
      name: 'Upper A',
      label: 'Upper',
      slots: [
        S('h_push', 'main', ...HPUSH_A),
        S('h_pull', 'main', ...HPULL_A),
        S('v_push', 'secondary', ...VPUSH_DB),
        S('v_pull', 'secondary', ...VPULL_B),
        S('elbow_flex', 'accessory', ...CURL),
        S('elbow_ext', 'accessory', ...TRI),
      ],
    },
    {
      name: 'Lower A',
      label: 'Lower',
      slots: [
        S('squat', 'main', ...SQUAT_A),
        S('hinge', 'secondary', ...HINGE_A),
        S('lunge', 'secondary', ...LUNGE),
        S('knee_flex', 'accessory', ...HAM),
        S('calf', 'accessory', ...CALF),
        S('core', 'core', ...CORE_A),
      ],
    },
    {
      name: 'Upper B',
      label: 'Upper',
      slots: [
        S('v_push', 'main', ...VPUSH),
        S('v_pull', 'main', ...VPULL),
        S('h_push', 'secondary', ...HPUSH_B),
        S('h_pull', 'secondary', ...HPULL_B),
        S('lateral_raise', 'accessory', ...LATERAL),
        S('rear_delt', 'accessory', ...REAR),
      ],
    },
    {
      name: 'Lower B',
      label: 'Lower',
      slots: [
        S('hinge', 'main', ...HINGE_B),
        S('squat', 'secondary', ...SQUAT_B),
        S('hip_ext', 'secondary', ...GLUTE),
        S('knee_ext', 'accessory', ...QUAD_ISO),
        S('calf', 'accessory', ...CALF),
        S('core', 'core', ...CORE_B),
      ],
    },
  ],
  ppl: [
    {
      name: 'Push A',
      label: 'Push',
      slots: [
        S('h_push', 'main', ...HPUSH_A),
        S('v_push', 'secondary', ...VPUSH_DB),
        S('h_push', 'secondary', ...HPUSH_B),
        S('chest_fly', 'accessory', ...FLY),
        S('lateral_raise', 'accessory', ...LATERAL),
        S('elbow_ext', 'accessory', ...TRI),
      ],
    },
    {
      name: 'Pull A',
      label: 'Pull',
      slots: [
        S('v_pull', 'main', ...VPULL),
        S('h_pull', 'secondary', ...HPULL_A),
        S('h_pull', 'secondary', ...HPULL_B),
        S('rear_delt', 'accessory', ...REAR),
        S('elbow_flex', 'accessory', ...CURL),
        S('elbow_flex', 'accessory', ...HAMMER),
      ],
    },
    {
      name: 'Legs A',
      label: 'Legs',
      slots: [
        S('squat', 'main', ...SQUAT_A),
        S('hinge', 'secondary', ...HINGE_A),
        S('lunge', 'secondary', ...LUNGE),
        S('knee_flex', 'accessory', ...HAM),
        S('calf', 'accessory', ...CALF),
        S('core', 'core', ...CORE_A),
      ],
    },
    {
      name: 'Push B',
      label: 'Push',
      slots: [
        S('v_push', 'main', ...VPUSH),
        S('h_push', 'secondary', ...HPUSH_B),
        S('h_push', 'secondary', ...HPUSH_A),
        S('lateral_raise', 'accessory', ...LATERAL),
        S('elbow_ext', 'accessory', ...TRI_B),
        S('core', 'core', ...CORE_C),
      ],
    },
    {
      name: 'Pull B',
      label: 'Pull',
      slots: [
        S('h_pull', 'main', ...HPULL_A),
        S('v_pull', 'secondary', ...VPULL_B),
        S('h_pull', 'secondary', ...HPULL_B),
        S('rear_delt', 'accessory', ...REAR),
        S('elbow_flex', 'accessory', ...HAMMER),
        S('core', 'core', ...CORE_B),
      ],
    },
    {
      name: 'Legs B',
      label: 'Legs',
      slots: [
        S('hinge', 'main', ...HINGE_B),
        S('squat', 'secondary', ...SQUAT_B),
        S('hip_ext', 'secondary', ...GLUTE),
        S('knee_ext', 'accessory', ...QUAD_ISO),
        S('calf', 'accessory', ...CALF),
        S('core', 'core', ...CORE_C),
      ],
    },
  ],
  ppl_ul: [],
};

// Five days: push, pull, legs, then an upper and a lower day.
TEMPLATES.ppl_ul = [TEMPLATES.ppl[0], TEMPLATES.ppl[1], TEMPLATES.ppl[2], TEMPLATES.upper_lower[2], TEMPLATES.upper_lower[3]];

const FINISHER_PREFER = ['rower', 'bike_intervals', 'kb_swing_intervals', 'burpee', 'mountain_climber', 'high_knees', 'jumping_jack', 'skater_jump'];

interface Scheme {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
}

/**
 * Rep schemes follow mainstream hypertrophy and conditioning guidance:
 * moderate reps near failure for muscle gain, shorter rests and higher reps
 * for general fitness and fat loss.
 */
export function schemeFor(focus: Focus, role: Role, experience: Experience, timed: boolean): Scheme {
  if (role === 'finisher') {
    return focus === 'lean' ? { sets: 4, repMin: 30, repMax: 45, restSec: 30 } : { sets: 3, repMin: 30, repMax: 40, restSec: 40 };
  }
  if (timed) {
    const base = experience === 'beginner' ? 20 : 30;
    return { sets: 3, repMin: base, repMax: base + 20, restSec: 45 };
  }
  const extraMainSet = experience === 'advanced' ? 1 : 0;
  const table: Record<Focus, Record<Exclude<Role, 'finisher'>, Scheme>> = {
    grow: {
      main: { sets: (experience === 'beginner' ? 3 : 4) + extraMainSet, repMin: 6, repMax: 10, restSec: 150 },
      secondary: { sets: 3, repMin: 8, repMax: 12, restSec: 120 },
      accessory: { sets: 3, repMin: 10, repMax: 15, restSec: 75 },
      core: { sets: 3, repMin: 10, repMax: 15, restSec: 60 },
    },
    fit: {
      main: { sets: 3, repMin: 8, repMax: 12, restSec: 90 },
      secondary: { sets: 3, repMin: 10, repMax: 12, restSec: 75 },
      accessory: { sets: 3, repMin: 12, repMax: 15, restSec: 60 },
      core: { sets: 3, repMin: 12, repMax: 20, restSec: 45 },
    },
    lean: {
      main: { sets: 3, repMin: 10, repMax: 12, restSec: 75 },
      secondary: { sets: 3, repMin: 12, repMax: 15, restSec: 60 },
      accessory: { sets: 3, repMin: 12, repMax: 20, restSec: 45 },
      core: { sets: 3, repMin: 15, repMax: 20, restSec: 40 },
    },
  };
  return table[focus][role];
}

export function splitForDays(daysPerWeek: number): SplitId {
  if (daysPerWeek <= 3) return 'full_body';
  if (daysPerWeek === 4) return 'upper_lower';
  if (daysPerWeek === 5) return 'ppl_ul';
  return 'ppl';
}

export const SPLIT_LABELS: Record<SplitId, string> = {
  full_body: 'Full body',
  upper_lower: 'Upper and lower',
  ppl: 'Push, pull, legs',
  ppl_ul: 'Push, pull, legs plus upper and lower',
};

function pickExercise(slot: Slot, equipment: readonly EquipmentId[], used: Set<string>): string | null {
  for (const id of slot.prefer) {
    const exercise = EXERCISE_BY_ID[id];
    if (exercise && !used.has(id) && isAvailable(exercise, equipment)) return id;
  }
  const fallback = bestSubstitute(slot.prefer[0], equipment, [...used]);
  return fallback && !used.has(fallback.id) ? fallback.id : null;
}

export interface ProgramInput {
  focus: Focus;
  experience: Experience;
  daysPerWeek: number;
  equipment: readonly EquipmentId[];
}

function buildDay(template: DayTemplate, dayIndex: number, input: ProgramInput, withFinisher: boolean): ProgramDay {
  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];
  const slots = withFinisher ? [...template.slots, S('conditioning', 'finisher', ...FINISHER_PREFER)] : template.slots;
  slots.forEach((slot, slotIndex) => {
    const exerciseId = pickExercise(slot, input.equipment, used);
    if (!exerciseId) return;
    used.add(exerciseId);
    const timed = getExercise(exerciseId).measure === 'time';
    exercises.push({
      id: `d${dayIndex}-s${slotIndex}`,
      exerciseId,
      ...schemeFor(input.focus, slot.role, input.experience, timed),
    });
  });
  return { id: `day-${dayIndex}`, name: template.name, label: template.label, exercises };
}

export function generateProgram(input: ProgramInput): Program {
  const split = splitForDays(input.daysPerWeek);
  const templates = TEMPLATES[split];
  const dayCount = split === 'full_body' ? Math.max(1, Math.min(3, input.daysPerWeek)) : templates.length;
  // A finisher keeps sessions dense for fat loss and conditioning goals.
  const withFinisher = input.focus !== 'grow';
  const days = templates
    .slice(0, Math.max(dayCount, split === 'full_body' ? 2 : dayCount))
    .map((template, i) => buildDay(template, i, input, withFinisher));
  return { id: uid('prog_'), split, focus: input.focus, days, createdAt: Date.now() };
}

/**
 * Home version of a program day: every exercise that needs missing equipment
 * is swapped for the closest movement that works with what is at home.
 */
export function homeVersionOfDay(day: ProgramDay, homeEquipment: readonly EquipmentId[]): ProgramDay {
  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];
  for (const planned of day.exercises) {
    const sub = bestSubstitute(planned.exerciseId, homeEquipment, [...used]);
    if (!sub) continue;
    used.add(sub.id);
    const original = getExercise(planned.exerciseId);
    // Body weight versions of loaded lifts need more reps to reach a similar effort.
    const bumpReps = original.externalLoad && !sub.externalLoad && sub.measure === 'reps';
    exercises.push({
      ...planned,
      id: `${planned.id}-home`,
      exerciseId: sub.id,
      repMin: bumpReps ? Math.max(planned.repMin, 10) : planned.repMin,
      repMax: bumpReps ? Math.max(planned.repMax, 20) : planned.repMax,
    });
  }
  return { ...day, id: `${day.id}-home`, name: `${day.name} (home)`, exercises };
}

/** Light mobility and movement session for low-readiness days. Still counts as showing up. */
export function recoveryDay(): ProgramDay {
  const plan: [string, number, number, number, number][] = [
    ['cat_cow', 2, 8, 10, 20],
    ['worlds_greatest_stretch', 2, 5, 6, 20],
    ['thoracic_rotation', 2, 8, 10, 20],
    ['glute_bridge', 2, 12, 15, 30],
    ['bird_dog', 2, 8, 10, 20],
    ['dead_bug', 2, 8, 10, 30],
    ['hip_flexor_stretch', 2, 30, 45, 15],
    ['childs_pose', 1, 45, 60, 0],
    ['brisk_walk', 1, 600, 900, 0],
  ];
  return {
    id: 'recovery',
    name: 'Recovery Rite',
    label: 'Recovery',
    exercises: plan.map(([exerciseId, sets, repMin, repMax, restSec], i) => ({
      id: `rec-${i}`,
      exerciseId,
      sets,
      repMin,
      repMax,
      restSec,
    })),
  };
}
