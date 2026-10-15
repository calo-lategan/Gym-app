import { dayActivityFor, mergeActivity } from './activity';
import type { WorkoutSession } from './types';

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

describe('activity', () => {
  it('files runs under the day they started and keeps distance only when tracked', () => {
    const days = mergeActivity(
      [
        { dayKey: '2026-10-14', steps: 8421.4, km: 0 },
        { dayKey: '2026-10-15', steps: 12_050, km: 9.123 },
      ],
      [{ startedAt: at(15, 7), endedAt: at(15, 7) + 28 * 60_000, km: 5.017 }],
    );
    expect(days[0]).toEqual({ dayKey: '2026-10-14', steps: 8421, distanceKm: null, runs: [], source: 'health' });
    expect(days[1].distanceKm).toBe(9.12);
    expect(days[1].runs).toEqual([{ km: 5.02, minutes: 28 }]);
  });

  it('adds finished gym sessions of that day for the energy model', () => {
    const session = {
      dayKey: '2026-10-15',
      kind: 'standard',
      startedAt: at(15, 18),
      endedAt: at(15, 19),
      exercises: [{ sets: Array(20).fill({}) }],
    } as unknown as WorkoutSession;
    const unfinished = { ...session, endedAt: undefined } as WorkoutSession;
    const day = dayActivityFor(undefined, [session, unfinished], '2026-10-15');
    expect(day).toEqual({ steps: 0, distanceKm: null, runs: [], gym: [{ minutes: 60, intensity: 'moderate' }] });
  });
});
