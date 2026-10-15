import { BALANCE } from './game/balance';
import { ZONE_COUNT, zoneForFloor } from './game/dungeon';

/**
 * Music slots: every area of the app that can have its own track. A file in
 * assets/music named after a slot id (battle.mp3, camp.m4a) fills it; an
 * empty slot plays its fallback instead.
 */
export const ZONE_BATTLES = ['battle-1', 'battle-2', 'battle-3', 'battle-4', 'battle-5', 'battle-6'] as const;

export type SlotId = 'title' | 'camp' | 'map' | 'check-in' | 'battle' | (typeof ZONE_BATTLES)[number] | 'boss' | 'victory' | 'lair' | 'merchant';

/** What actually plays: a slot's own file, or the dungeon ambience drone. */
export type Track = SlotId | 'ambience';

export interface MusicSlot {
  id: SlotId;
  /** Where it plays. */
  area: string;
  /** A brief for whoever composes it: mood, instruments and tempo. */
  brief: string;
  /** Plays while this slot has no file of its own. */
  fallback: SlotId | 'ambience' | null;
}

const ZONE_BRIEFS = [
  'The first floors. Bright and eager, the adventure is new.',
  'Narrow tunnels. A restless, skittering rhythm.',
  'A haunted crypt. Breathy flute drowned in reverb over steady drums.',
  'Heat and hammers. Heavy taiko and metallic hits.',
  'Cold halls of black glass. Precise, minimal and futuristic.',
  'The final descent. Epic and relentless.',
];

export const MUSIC_SLOTS: readonly MusicSlot[] = [
  {
    id: 'title',
    area: 'Title and setup',
    brief: 'The first thing a new hero hears. Calm and inviting: shakuhachi over a slow synth pad. 70 to 90 BPM.',
    fallback: null,
  },
  {
    id: 'camp',
    area: 'Camp',
    brief: 'Resting by the fire between battles. Warm and unhurried: koto and soft percussion. 60 to 80 BPM. It plays often, so keep it gentle.',
    fallback: 'ambience',
  },
  {
    id: 'map',
    area: 'Dungeon map',
    brief: 'Looking down the stairwell. Mysterious and curious: biwa plucks over a low drone. 80 to 100 BPM.',
    fallback: 'camp',
  },
  {
    id: 'check-in',
    area: 'Before you fight',
    brief: 'The breath before battle. A taiko heartbeat that slowly builds. 90 to 110 BPM; a short loop is fine.',
    fallback: 'camp',
  },
  {
    id: 'battle',
    area: 'Battle',
    brief:
      'Plays through every workout that has no zone theme, so it must stay fun for an hour: taiko, shamisen and a pulsing synth bass. 120 to 150 BPM.',
    fallback: null,
  },
  ...ZONE_BATTLES.map((id, i): MusicSlot => ({
    id,
    area: `Battle in ${zoneForFloor(i * BALANCE.dungeon.bossEvery + 1).name}`,
    brief: `${ZONE_BRIEFS[i]} Same energy as the main battle theme.`,
    fallback: 'battle',
  })),
  {
    id: 'boss',
    area: 'Guardian fight',
    brief: 'The exercise that fights a floor guardian. Heavier and faster than battle: war drums and choir. 140 to 160 BPM.',
    fallback: 'battle',
  },
  {
    id: 'victory',
    area: 'Victory',
    brief: 'Loot and level ups after a workout. A triumphant opening that settles into a calm loop. 100 to 120 BPM.',
    fallback: null,
  },
  {
    id: 'lair',
    area: "The dragon's lair",
    brief: 'Facing the dragon that guards your real goal. Ominous and huge: deep drums, low brass and choir. 60 to 80 BPM.',
    fallback: 'ambience',
  },
  {
    id: 'merchant',
    area: 'Merchant',
    brief: 'Shopping for gear. Playful and light: shamisen and woodblock. 100 to 120 BPM.',
    fallback: 'camp',
  },
];

const BY_ID = new Map(MUSIC_SLOTS.map((slot) => [slot.id, slot]));

export function musicSlot(id: SlotId): MusicSlot {
  return BY_ID.get(id)!;
}

/** The battle slot for a dungeon zone; zones past the last one reuse its theme. */
export function battleSlot(zoneIndex: number): SlotId {
  return ZONE_BATTLES[Math.min(Math.max(0, zoneIndex), Math.min(ZONE_COUNT, ZONE_BATTLES.length) - 1)];
}

/**
 * Follows a slot's fallbacks to the first one with a file. Null means
 * silence: the slot and its fallbacks are empty, or ambience is switched off.
 */
export function resolveTrack(slot: SlotId, available: ReadonlySet<string>, ambience: boolean): Track | null {
  let next: SlotId | 'ambience' | null = slot;
  for (let hops = 0; next && hops <= MUSIC_SLOTS.length; hops++) {
    if (next === 'ambience') return ambience ? 'ambience' : null;
    if (available.has(next)) return next;
    next = musicSlot(next).fallback;
  }
  return null;
}

export interface MusicContext {
  zoneIndex: number;
  /** The current exercise is a guardian's challenge. */
  bossFight: boolean;
}

/** The slot for a screen, or `keep` for screens that let the current music play on. */
export function areaForRoute(pathname: string, context: MusicContext): SlotId | 'keep' {
  const [first = ''] = pathname.split('/').filter(Boolean);
  switch (first) {
    case '':
      return 'camp';
    case 'onboarding':
      return 'title';
    case 'dungeon':
      return 'map';
    case 'check-in':
      return 'check-in';
    case 'workout':
      return context.bossFight ? 'boss' : battleSlot(context.zoneIndex);
    case 'victory':
      return 'victory';
    case 'lair':
      return 'lair';
    case 'shop':
      return 'merchant';
    default:
      return 'keep';
  }
}
