import { ZONE_COUNT } from './game/dungeon';
import { areaForRoute, battleSlot, MUSIC_SLOTS, resolveTrack, ZONE_BATTLES } from './music';

const files = (...ids: string[]) => new Set(ids);
const camp = { zoneIndex: 0, bossFight: false };

describe('music slots', () => {
  it('gives every dungeon zone a battle slot', () => {
    expect(ZONE_BATTLES).toHaveLength(ZONE_COUNT);
    expect(battleSlot(0)).toBe('battle-1');
    expect(battleSlot(5)).toBe('battle-6');
    expect(battleSlot(9)).toBe('battle-6');
  });

  it('has unique ids whose fallbacks exist and never loop', () => {
    const ids = new Set(MUSIC_SLOTS.map((s) => s.id));
    expect(ids.size).toBe(MUSIC_SLOTS.length);
    for (const slot of MUSIC_SLOTS) {
      const seen = new Set<string>();
      let next = slot.fallback;
      while (next && next !== 'ambience') {
        expect(ids.has(next)).toBe(true);
        expect(seen.has(next)).toBe(false);
        seen.add(next);
        next = MUSIC_SLOTS.find((s) => s.id === next)!.fallback;
      }
    }
  });

  it('plays a slot that has a file', () => {
    expect(resolveTrack('battle-3', files('battle-3', 'battle'), true)).toBe('battle-3');
  });

  it('falls back through empty slots', () => {
    expect(resolveTrack('battle-3', files('battle'), true)).toBe('battle');
    expect(resolveTrack('boss', files('battle'), true)).toBe('battle');
    expect(resolveTrack('merchant', files('camp'), true)).toBe('camp');
    expect(resolveTrack('merchant', files(), true)).toBe('ambience');
  });

  it('stays silent when the chain is empty or ambience is off', () => {
    expect(resolveTrack('victory', files(), true)).toBeNull();
    expect(resolveTrack('battle-1', files(), true)).toBeNull();
    expect(resolveTrack('camp', files(), false)).toBeNull();
  });

  it('maps screens to their areas', () => {
    expect(areaForRoute('/', camp)).toBe('camp');
    expect(areaForRoute('/onboarding', camp)).toBe('title');
    expect(areaForRoute('/dungeon', camp)).toBe('map');
    expect(areaForRoute('/check-in', camp)).toBe('check-in');
    expect(areaForRoute('/workout', { zoneIndex: 2, bossFight: false })).toBe('battle-3');
    expect(areaForRoute('/workout', { zoneIndex: 2, bossFight: true })).toBe('boss');
    expect(areaForRoute('/victory', camp)).toBe('victory');
    expect(areaForRoute('/lair', camp)).toBe('lair');
    expect(areaForRoute('/shop', camp)).toBe('merchant');
  });

  it('lets menus keep the music that is playing', () => {
    for (const path of ['/settings', '/plan', '/plan/day-1', '/hero', '/history', '/energy', '/item/abc']) {
      expect(areaForRoute(path, camp)).toBe('keep');
    }
  });
});
