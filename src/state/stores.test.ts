import { useGame } from './stores';

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

describe('saved game', () => {
  it('fills settings added since the last save with their defaults', async () => {
    const saved = { onboarded: true, settings: { sound: false, ambience: true, haptics: true, graphics: 'lite', use24h: true } };
    localStorage.setItem('ironwyrm.game', JSON.stringify({ state: saved, version: 1 }));
    await useGame.persist.rehydrate();
    expect(useGame.getState().onboarded).toBe(true);
    expect(useGame.getState().settings).toEqual({ sound: false, music: true, ambience: true, haptics: true, graphics: 'lite', use24h: true });
  });
});
