import { dayKeyOf } from './dates';
import { gymIntensity, sessionMinutes, type DayActivity } from './energy';
import type { DayKey, WorkoutSession } from './types';

/** One day of movement from a step tracker, or typed in by hand. */
export interface ActivityDay {
  dayKey: DayKey;
  steps: number;
  /** Total distance in km, runs included, or null when the tracker only counts steps. */
  distanceKm: number | null;
  runs: { km: number; minutes: number }[];
  source: 'health' | 'manual';
}

export interface DayTotals {
  dayKey: DayKey;
  steps: number;
  /** Raw distance; trackers that only count steps report zero. */
  km: number;
}

export interface RawRun {
  startedAt: number;
  endedAt: number;
  km: number;
}

/** Combines per-day totals with run sessions, filing each run under the local day it started. */
export function mergeActivity(totals: readonly DayTotals[], runs: readonly RawRun[]): ActivityDay[] {
  return totals.map((t) => ({
    dayKey: t.dayKey,
    steps: Math.max(0, Math.round(t.steps)),
    distanceKm: t.km > 0 ? Math.round(t.km * 100) / 100 : null,
    runs: runs
      .filter((r) => dayKeyOf(r.startedAt) === t.dayKey && r.endedAt > r.startedAt)
      .map((r) => ({ km: Math.round(r.km * 100) / 100, minutes: Math.round((r.endedAt - r.startedAt) / 60_000) })),
    source: 'health' as const,
  }));
}

/** The energy model's view of a day: tracker movement plus finished gym sessions. */
export function dayActivityFor(day: ActivityDay | undefined, sessions: readonly WorkoutSession[], dayKey: DayKey): DayActivity {
  return {
    steps: day?.steps ?? 0,
    distanceKm: day?.distanceKm ?? null,
    runs: day?.runs ?? [],
    gym: sessions.filter((s) => s.dayKey === dayKey && s.endedAt).map((s) => ({ minutes: sessionMinutes(s), intensity: gymIntensity(s) })),
  };
}
