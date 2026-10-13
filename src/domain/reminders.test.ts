import { addDays } from './dates';
import { newHero } from './game/progression';
import { milestoneStepKg, resolveCheckIn, resolveWeighIn } from './game/weighin';
import { moveOptions, planReminders, swapRestDay } from './reminders';
import { defaultSchedule, isTrainingDay } from './schedule';
import type { Goal, WeighIn } from './types';

const context = {
  heroName: 'Calo',
  streak: 4,
  completedDays: new Set<string>(),
  nextDayName: 'Push A',
  floor: 3,
  dragonName: 'Vaelgrith',
};

describe('planReminders', () => {
  // Tuesday 13 October 2026, 10:00.
  const now = new Date(2026, 9, 13, 10, 0);

  it('schedules a reminder at gym time on each training day only', () => {
    const reminders = planReminders(defaultSchedule(), now, context, 7).filter((r) => r.kind === 'session');
    expect(reminders.map((r) => r.day)).toEqual(['2026-10-13', '2026-10-15', '2026-10-16', '2026-10-19']);
    expect(reminders[0].date.getHours()).toBe(18);
    expect(reminders[0].body).toMatch(/4-day streak/);
  });

  it('honours a moved session and a swapped rest day', () => {
    const schedule = { ...defaultSchedule(), overrides: { '2026-10-13': { hour: 20, minute: 30 } } };
    const moved = planReminders(schedule, now, context, 2).find((r) => r.day === '2026-10-13');
    expect(moved?.date.getHours()).toBe(20);
    expect(moved?.date.getMinutes()).toBe(30);

    const swapped = swapRestDay(defaultSchedule(), '2026-10-13');
    expect(isTrainingDay(swapped, '2026-10-13')).toBe(false);
    expect(isTrainingDay(swapped, '2026-10-14')).toBe(true);
  });

  it('skips days already trained and times already passed', () => {
    const late = new Date(2026, 9, 13, 19, 0);
    const days = planReminders(defaultSchedule(), late, context, 3).map((r) => r.day);
    expect(days).not.toContain('2026-10-13');
    const done = planReminders(defaultSchedule(), now, { ...context, completedDays: new Set(['2026-10-13']) }, 3);
    expect(done.map((r) => r.day)).not.toContain('2026-10-13');
  });

  it('returns nothing when reminders are off', () => {
    expect(planReminders({ ...defaultSchedule(), remindersEnabled: false }, now, context)).toEqual([]);
  });

  it('adds a single comeback nudge at the end of the window', () => {
    const reminders = planReminders(defaultSchedule(), now, context, 14);
    expect(reminders.filter((r) => r.kind === 'comeback')).toHaveLength(1);
  });

  it('offers only future times to move a session to', () => {
    const options = moveOptions(new Date(2026, 9, 13, 17, 0));
    expect(options[0].label).toBe('In an hour');
    expect(options.map((o) => o.label)).not.toContain('Lunch');
    expect(options.map((o) => o.label)).toContain('Night');
  });
});

describe('weigh-ins', () => {
  const goal: Goal = { kind: 'bodyweight', start: 90, target: 80, createdAt: 0 };
  const series = (values: number[]): WeighIn[] =>
    values.map((kg, i) => ({ dayKey: addDays('2026-10-13', -values.length + 1 + i), kg, at: 0 }));

  it('pays a milestone per 1% of starting weight lost, judged on the weekly average', () => {
    expect(milestoneStepKg(goal)).toBe(0.9);
    const hero = newHero('A', 'knight');
    const result = resolveWeighIn(hero, goal, series([88.4, 88.2, 88, 88.1, 87.9, 88, 87.8]), '2026-10-13', true);
    expect(result.newMilestones).toBe(2);
    expect(result.hero.stats.vit).toBe(3);
    expect(result.hero.weightMilestones).toBe(2);
  });

  it('never pays the same milestone twice', () => {
    const hero = { ...newHero('A', 'knight'), weightMilestones: 2 };
    const result = resolveWeighIn(hero, goal, series([88.0, 88.0, 88.0]), '2026-10-13', false);
    expect(result.newMilestones).toBe(0);
    expect(result.xp).toBe(0);
  });

  it('ignores movement in the wrong direction', () => {
    const result = resolveWeighIn(newHero('A', 'knight'), goal, series([92, 93]), '2026-10-13', true);
    expect(result.newMilestones).toBe(0);
  });

  it('grants Vitality every seventh check-in', () => {
    let hero = newHero('A', 'knight');
    let vit = 0;
    for (let i = 0; i < 7; i++) {
      const r = resolveCheckIn(hero, true);
      hero = r.hero;
      vit += r.vit;
    }
    expect(vit).toBe(1);
    expect(resolveCheckIn(hero, false).xp).toBe(0);
  });
});
