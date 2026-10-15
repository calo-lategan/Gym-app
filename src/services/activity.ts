import {
  aggregateRecord,
  ExerciseType,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import { mergeActivity, type ActivityDay, type RawRun } from '@/domain/activity';
import { addDays, dayKeyOf, parseDayKey } from '@/domain/dates';
import type { DayKey, WeighIn } from '@/domain/types';

/**
 * Health Connect is Android's shared health store. Samsung Health, Google Fit
 * and most watches sync steps, distance, workouts and weight into it, so one
 * read covers them all. Access is read-only.
 */
const PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Weight' },
];

const RUN_TYPES: number[] = [ExerciseType.RUNNING, ExerciseType.RUNNING_TREADMILL];

export type ActivityAvailability = 'ready' | 'needs-permission' | 'needs-update' | 'unavailable';

export async function activityAvailability(): Promise<ActivityAvailability> {
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update';
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return 'unavailable';
    await initialize();
    const granted = await getGrantedPermissions();
    return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read') ? 'ready' : 'needs-permission';
  } catch {
    return 'unavailable';
  }
}

/** Shows the Health Connect permission sheet. True when step access was granted. */
export async function connectActivity(): Promise<boolean> {
  try {
    if (!(await initialize())) return false;
    const granted = await requestPermission(PERMISSIONS);
    return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
  } catch {
    return false;
  }
}

export function openActivitySettings() {
  try {
    openHealthConnectSettings();
  } catch {
    // Older Health Connect builds have no settings screen to open.
  }
}

const between = (start: Date, end: Date) => ({ operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() });

/** The last `days` days up to now, oldest first. */
export async function readActivity(days: number, now = new Date()): Promise<ActivityDay[]> {
  await initialize();
  const today = dayKeyOf(now);
  const keys: DayKey[] = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  // One query per local day, so midnight follows the phone's own time zone.
  const totals = await Promise.all(
    keys.map(async (dayKey) => {
      const start = parseDayKey(dayKey);
      const nextDay = parseDayKey(addDays(dayKey, 1));
      const range = between(start, nextDay < now ? nextDay : now);
      const [steps, distance] = await Promise.all([
        aggregateRecord({ recordType: 'Steps', timeRangeFilter: range }).catch(() => null),
        aggregateRecord({ recordType: 'Distance', timeRangeFilter: range }).catch(() => null),
      ]);
      return { dayKey, steps: steps?.COUNT_TOTAL ?? 0, km: distance?.DISTANCE.inKilometers ?? 0 };
    }),
  );

  const sessions = await readRecords('ExerciseSession', { timeRangeFilter: between(parseDayKey(keys[0]), now) }).catch(() => null);
  const runs: RawRun[] = await Promise.all(
    (sessions?.records ?? [])
      .filter((s) => RUN_TYPES.includes(s.exerciseType))
      .map(async (s) => {
        const distance = await aggregateRecord({
          recordType: 'Distance',
          timeRangeFilter: { operator: 'between', startTime: s.startTime, endTime: s.endTime },
        }).catch(() => null);
        return { startedAt: Date.parse(s.startTime), endedAt: Date.parse(s.endTime), km: distance?.DISTANCE.inKilometers ?? 0 };
      }),
  );
  return mergeActivity(totals, runs);
}

/** Weigh-ins recorded by smart scales and health apps in the last `days` days. */
export async function readWeighIns(days: number, now = new Date()): Promise<WeighIn[]> {
  try {
    await initialize();
    const start = parseDayKey(addDays(dayKeyOf(now), -days));
    const result = await readRecords('Weight', { timeRangeFilter: between(start, now) });
    return result.records.map((r) => {
      const at = Date.parse(r.time);
      return { dayKey: dayKeyOf(at), kg: Math.round(r.weight.inKilograms * 10) / 10, at };
    });
  } catch {
    return [];
  }
}
