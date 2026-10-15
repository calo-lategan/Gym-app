import type { ActivityDay } from '@/domain/activity';

import { applyActivitySync, logFood, removeFood, resetAll, setManualSteps } from './actions';
import { parseBackup, serializeBackup } from './backup';
import { useActivity, useGame, useHistory } from './stores';

// Hoisted above the imports by Jest.
jest.mock('expo-sqlite/localStorage/install', () => {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }).localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
  return {};
});

const NOW = new Date(2026, 9, 15, 12).getTime();
const tracked = (dayKey: string, steps: number): ActivityDay => ({ dayKey, steps, distanceKm: null, runs: [], source: 'health' });

describe('energy actions', () => {
  beforeEach(() => resetAll());

  it('stores synced days and drops ones older than sixty days', () => {
    useActivity.setState({ days: { '2026-07-01': tracked('2026-07-01', 5000) } });
    applyActivitySync([tracked('2026-10-14', 9000), tracked('2026-10-15', 3000)], NOW);
    const state = useActivity.getState();
    expect(state.connected).toBe(true);
    expect(state.lastSync).toBe(NOW);
    expect(Object.keys(state.days).sort()).toEqual(['2026-10-14', '2026-10-15']);
  });

  it('keeps steps typed by hand unless the tracker counted that day', () => {
    setManualSteps('2026-10-14', 7000);
    setManualSteps('2026-10-15', 4000);
    applyActivitySync([tracked('2026-10-14', 0), tracked('2026-10-15', 5200)], NOW);
    expect(useActivity.getState().days['2026-10-14']).toMatchObject({ steps: 7000, source: 'manual' });
    expect(useActivity.getState().days['2026-10-15']).toMatchObject({ steps: 5200, source: 'health' });
  });

  it('logs food for today and removes it', () => {
    expect(logFood({ kcal: 0, proteinG: 10 }, NOW)).toBeNull();
    const entry = logFood({ kcal: 642.4, proteinG: 41.6, label: '  ' }, NOW);
    expect(entry).toMatchObject({ dayKey: '2026-10-15', kcal: 642, proteinG: 42, label: 'Meal' });
    removeFood(entry!.id);
    expect(useHistory.getState().foods).toEqual([]);
  });

  it('carries the food log through a backup', () => {
    logFood({ kcal: 500, proteinG: 30, label: 'Rice and chicken' }, NOW);
    const parsed = parseBackup(serializeBackup(useGame.getState(), useHistory.getState()));
    expect(parsed.ok && parsed.history.foods.map((f) => f.label)).toEqual(['Rice and chicken']);
  });
});
