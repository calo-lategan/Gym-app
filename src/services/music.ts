import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { resolveTrack, type SlotId, type Track } from '@/domain/music';

import { MUSIC_FILES } from './music-files';

const AMBIENCE = require('@/assets/sounds/ambience-dungeon.mp3');
const AVAILABLE: ReadonlySet<string> = new Set(Object.keys(MUSIC_FILES));
const NONE: ReadonlySet<string> = new Set();
const VOLUME = { music: 0.6, ambience: 0.35 };
const FADE_MS = 900;
const STEP_MS = 50;

interface Deck {
  track: Track;
  player: AudioPlayer;
  timer: ReturnType<typeof setInterval> | null;
}

let deck: Deck | null = null;
let area: SlotId | null = null;
let preview: SlotId | null = null;
let options = { music: true, ambience: true };
let background = false;

export const hasMusic = () => AVAILABLE.size > 0;
export const hasTrack = (slot: SlotId) => AVAILABLE.has(slot);

function fade(target: Deck, to: number, done?: () => void) {
  if (target.timer) clearInterval(target.timer);
  const from = target.player.volume;
  const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let step = 0;
  target.timer = setInterval(() => {
    step += 1;
    try {
      target.player.volume = from + (to - from) * (step / steps);
    } catch {
      // A released player has nothing left to fade.
    }
    if (step >= steps) {
      if (target.timer) clearInterval(target.timer);
      target.timer = null;
      done?.();
    }
  }, STEP_MS);
}

function wanted(): Track | null {
  if (preview) return preview;
  // Browsers block audio until the first tap, so area music is a native-only touch.
  if (!area || process.env.EXPO_OS === 'web') return null;
  return resolveTrack(area, options.music ? AVAILABLE : NONE, options.ambience);
}

/** Crossfades to whatever the current area, settings and preview call for. */
function sync() {
  const track = wanted();
  if (deck?.track === track) return;
  const old = deck;
  deck = null;
  if (old) {
    fade(old, 0, () => {
      try {
        old.player.remove();
      } catch {
        // Already released.
      }
    });
  }
  if (!track) return;
  try {
    const player = createAudioPlayer(track === 'ambience' ? AMBIENCE : MUSIC_FILES[track]);
    player.loop = true;
    player.volume = 0;
    if (!background) player.play();
    deck = { track, player, timer: null };
    fade(deck, track === 'ambience' ? VOLUME.ambience : VOLUME.music);
  } catch {
    // Music is never worth a crash.
    deck = null;
  }
}

/** The area the player is in; screens that keep the current music never call this. */
export function setMusicArea(next: SlotId) {
  area = next;
  sync();
}

export function setMusicOptions(next: { music: boolean; ambience: boolean }) {
  options = next;
  sync();
}

/** Plays one slot's file from the Soundtrack screen; null returns to the area's music. */
export function previewTrack(slot: SlotId | null) {
  preview = slot && AVAILABLE.has(slot) ? slot : null;
  sync();
}

export function setMusicInBackground(isBackground: boolean) {
  background = isBackground;
  try {
    if (isBackground) deck?.player.pause();
    else deck?.player.play();
  } catch {
    // The player was released while the app was away; the next area change starts a new one.
  }
}
