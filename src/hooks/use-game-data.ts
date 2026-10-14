import { useMemo } from 'react';

import { dayKeyOf } from '@/domain/dates';
import { goalProgress } from '@/domain/game/dragon';
import { isTrainingDay, sessionTimeFor } from '@/domain/schedule';
import { averageWeight } from '@/domain/science';
import type { Goal } from '@/domain/types';
import { useGame, useHistory } from '@/state/stores';

export function useToday() {
  return dayKeyOf(new Date());
}

export function useTodayStatus() {
  const schedule = useGame((s) => s.schedule);
  const program = useGame((s) => s.program);
  const nextDayIndex = useGame((s) => s.nextDayIndex);
  const sessions = useHistory((s) => s.sessions);
  const today = useToday();
  return useMemo(() => {
    const trainingDay = isTrainingDay(schedule, today);
    const todaysSessions = sessions.filter((s) => s.dayKey === today && s.endedAt);
    const doneToday = todaysSessions.some((s) => s.scheduled);
    const day = program && program.days.length ? program.days[nextDayIndex % program.days.length] : null;
    return {
      today,
      trainingDay,
      doneToday,
      trainedAtAll: todaysSessions.length > 0,
      day,
      time: sessionTimeFor(schedule, today),
      override: schedule.overrides[today] ?? null,
    };
  }, [schedule, program, nextDayIndex, sessions, today]);
}

export function useLatestWeight(): number | null {
  const weighIns = useHistory((s) => s.weighIns);
  return weighIns.length ? weighIns[weighIns.length - 1].kg : null;
}

/** Live dragon progress against the real goal. */
export function useDragonProgress(): { goal: Goal | null; current: number | null; progress: number } {
  const dragon = useGame((s) => s.dragon);
  const records = useGame((s) => s.records);
  const weighIns = useHistory((s) => s.weighIns);
  const sessions = useHistory((s) => s.sessions);
  const today = useToday();
  return useMemo(() => {
    if (!dragon) return { goal: null, current: null, progress: 0 };
    const goal = dragon.goal;
    let current: number | null = null;
    if (goal.kind === 'bodyweight') current = averageWeight(weighIns, today) ?? weighIns.at(-1)?.kg ?? null;
    if (goal.kind === 'lift') current = goal.exerciseId ? (records[goal.exerciseId]?.bestE1rm ?? null) : null;
    if (goal.kind === 'sessions') current = sessions.filter((s) => s.endedAt && s.startedAt >= goal.createdAt).length;
    return { goal, current, progress: goalProgress(goal, current) };
  }, [dragon, records, weighIns, sessions, today]);
}

export function estimateMinutes(sets: number, avgRestSec: number): number {
  return Math.round((sets * (avgRestSec + 45)) / 60 / 5) * 5;
}
