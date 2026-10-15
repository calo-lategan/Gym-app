import { useMemo } from 'react';

import { dayActivityFor } from '@/domain/activity';
import { addDays } from '@/domain/dates';
import { ageFrom, dailyBurn, intakePlan, weightSlopeKgPerDay, type BodyStats } from '@/domain/energy';
import { readinessBand } from '@/domain/readiness';
import { isTrainingDay } from '@/domain/schedule';
import { averageWeight, weeklyWeightChangePct } from '@/domain/science';
import type { DayKey } from '@/domain/types';
import { useActivity, useGame, useHistory } from '@/state/stores';

import { useToday } from './use-game-data';

/** Days of history the intake model reads: four weeks for calibration, the latest week for burn. */
const WINDOW_DAYS = 28;
const BURN_DAYS = 7;
const MIN_TRACKED_DAYS = 3;
/** Stand-in body weight until the first weigh-in. */
const FALLBACK_WEIGHT_KG = 75;

/** Today's burn, the intake plan and a week of history, from every store the energy model needs. */
export function useEnergy() {
  const profile = useGame((s) => s.profile);
  const schedule = useGame((s) => s.schedule);
  const sessions = useHistory((s) => s.sessions);
  const weighIns = useHistory((s) => s.weighIns);
  const checkIns = useHistory((s) => s.checkIns);
  const foods = useHistory((s) => s.foods);
  const days = useActivity((s) => s.days);
  const today = useToday();

  return useMemo(() => {
    const weightKg = averageWeight(weighIns, today) ?? weighIns.at(-1)?.kg ?? FALLBACK_WEIGHT_KG;
    const body: BodyStats = { weightKg, heightCm: profile.heightCm, age: ageFrom(profile.birthYear, new Date()), sex: profile.sex };
    const burnOn = (key: DayKey) => dailyBurn(body, dayActivityFor(days[key], sessions, key));
    const intakeOn = (key: DayKey) => {
      const eaten = foods.filter((f) => f.dayKey === key);
      return eaten.length ? eaten.reduce((sum, f) => sum + f.kcal, 0) : null;
    };

    const window = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(today, i - WINDOW_DAYS));
    const tracked = window.filter((key) => days[key]).slice(-BURN_DAYS);
    const todaysCheckIn = checkIns.filter((c) => c.dayKey === today).at(-1);
    const plan = intakePlan({
      focus: profile.focus,
      body,
      recentBurn: tracked.length >= MIN_TRACKED_DAYS ? tracked.map((key) => burnOn(key).total) : [],
      recentIntake: window.map(intakeOn),
      weeklyChangePct: weeklyWeightChangePct(weighIns, today),
      slopeKgPerDay: weightSlopeKgPerDay(weighIns, today),
      readiness: todaysCheckIn ? readinessBand(todaysCheckIn.score) : null,
      trainingDay: isTrainingDay(schedule, today),
    });

    const todaysFoods = foods.filter((f) => f.dayKey === today);
    return {
      body,
      today: burnOn(today),
      trackedToday: Boolean(days[today]),
      plan,
      foods: todaysFoods,
      eatenKcal: todaysFoods.reduce((sum, f) => sum + f.kcal, 0),
      eatenProteinG: todaysFoods.reduce((sum, f) => sum + f.proteinG, 0),
      week: Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((key) => ({
        dayKey: key,
        burn: days[key] || key === today ? burnOn(key).total : null,
        intake: intakeOn(key),
      })),
    };
  }, [profile, schedule, sessions, weighIns, checkIns, foods, days, today]);
}
