import type { GameState, HistoryState } from './stores';

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'ironwyrm';
  version: number;
  exportedAt: string;
  game: GameState;
  history: HistoryState;
}

export type ParsedBackup = { ok: true; game: Partial<GameState>; history: HistoryState; exportedAt: string | null } | { ok: false; reason: string };

export function serializeBackup(game: GameState, history: HistoryState, now = new Date()): string {
  const backup: Backup = { app: 'ironwyrm', version: BACKUP_VERSION, exportedAt: now.toISOString(), game, history };
  return JSON.stringify(backup);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks a backup file before it replaces the current data. It accepts files
 * from this version and earlier ones, and refuses anything that does not look
 * like an Ironwyrm save so a wrong file can never wipe progress.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not an Ironwyrm backup.' };
  }
  if (!isObject(raw) || (raw.app !== undefined && raw.app !== 'ironwyrm')) {
    return { ok: false, reason: 'That file is not an Ironwyrm backup.' };
  }
  if (typeof raw.version === 'number' && raw.version > BACKUP_VERSION) {
    return { ok: false, reason: 'This backup comes from a newer version of Ironwyrm. Update the app first.' };
  }
  const game = raw.game;
  const history = isObject(raw.history) ? raw.history : {};
  if (
    !isObject(game) ||
    !isObject(game.hero) ||
    typeof game.hero.level !== 'number' ||
    !isObject(game.dungeon) ||
    typeof game.dungeon.floor !== 'number' ||
    !isObject(game.profile) ||
    !isObject(game.schedule) ||
    !Array.isArray(game.schedule.trainingDays)
  ) {
    return { ok: false, reason: 'This backup is damaged or incomplete, so nothing was changed.' };
  }
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    ok: true,
    game: game as Partial<GameState>,
    history: {
      sessions: list(history.sessions),
      weighIns: list(history.weighIns),
      checkIns: list(history.checkIns),
      foods: list(history.foods),
    } as HistoryState,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
  };
}
