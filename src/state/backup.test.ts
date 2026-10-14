import { BACKUP_VERSION, parseBackup, serializeBackup } from './backup';
import type { GameState, HistoryState } from './stores';

const game = {
  version: 1,
  onboarded: true,
  hero: { name: 'Calo', level: 4 },
  dungeon: { floor: 3 },
  profile: { unit: 'kg' },
  schedule: { trainingDays: [false, true, true, false, true, true, false] },
} as unknown as GameState;
const history = { sessions: [{ id: 's1' }], weighIns: [], checkIns: [] } as unknown as HistoryState;

describe('backups', () => {
  it('round-trips a save', () => {
    const parsed = parseBackup(serializeBackup(game, history, new Date('2026-10-14T08:00:00Z')));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.game.hero?.level).toBe(4);
    expect(parsed.history.sessions).toHaveLength(1);
    expect(parsed.exportedAt).toBe('2026-10-14T08:00:00.000Z');
  });

  it('accepts older exports without an app tag and fills missing history lists', () => {
    const parsed = parseBackup(JSON.stringify({ exportedAt: 'x', game, history: { sessions: [] } }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.history.weighIns).toEqual([]);
  });

  it('refuses files that are not Ironwyrm saves', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other', game })).ok).toBe(false);
    expect(parseBackup(JSON.stringify([1, 2, 3])).ok).toBe(false);
  });

  it('refuses damaged saves so they cannot wipe progress', () => {
    expect(parseBackup(JSON.stringify({ app: 'ironwyrm', game: { hero: {} } })).ok).toBe(false);
    const noSchedule = { ...game, schedule: {} };
    expect(parseBackup(JSON.stringify({ app: 'ironwyrm', game: noSchedule, history })).ok).toBe(false);
  });

  it('refuses saves from a newer version', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'ironwyrm', version: BACKUP_VERSION + 1, game, history }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/newer version/);
  });
});
