import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { useGame } from '@/state/stores';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES = {
  tap: require('@/assets/sounds/tap.mp3'),
  setStart: require('@/assets/sounds/set-start.mp3'),
  setEnd: require('@/assets/sounds/set-end.mp3'),
  slash: require('@/assets/sounds/slash.mp3'),
  hit: require('@/assets/sounds/hit.mp3'),
  crit: require('@/assets/sounds/crit.mp3'),
  monsterDeath: require('@/assets/sounds/monster-death.mp3'),
  coin: require('@/assets/sounds/coin.mp3'),
  xpTick: require('@/assets/sounds/xp-tick.mp3'),
  chestOpen: require('@/assets/sounds/chest-open.mp3'),
  lootRare: require('@/assets/sounds/loot-rare.mp3'),
  lootEpic: require('@/assets/sounds/loot-epic.mp3'),
  lootLegendary: require('@/assets/sounds/loot-legendary.mp3'),
  levelUp: require('@/assets/sounds/level-up.mp3'),
  pr: require('@/assets/sounds/pr.mp3'),
  restDone: require('@/assets/sounds/rest-done.mp3'),
  countdown: require('@/assets/sounds/countdown.mp3'),
  bossRoar: require('@/assets/sounds/boss-roar.mp3'),
  gateOpen: require('@/assets/sounds/gate-open.mp3'),
  streak: require('@/assets/sounds/streak.mp3'),
  dragonRoar: require('@/assets/sounds/dragon-roar.mp3'),
} as const;
const AMBIENCE = require('@/assets/sounds/ambience-dungeon.mp3');
/* eslint-enable @typescript-eslint/no-require-imports */

export type SoundName = keyof typeof SOURCES;

/** Sounds that can fire in quick succession get a small pool of players. */
const POOL_SIZE: Partial<Record<SoundName, number>> = { xpTick: 3, coin: 3, hit: 2, tap: 2 };

const players = new Map<SoundName, { list: AudioPlayer[]; next: number }>();
let ambience: AudioPlayer | null = null;
let ready = false;

export async function initSound() {
  if (ready) return;
  ready = true;
  try {
    // Mix with the lifter's own music instead of pausing it, and respect the silent switch.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
  } catch {
    // Audio mode is best effort; effects still play with defaults.
  }
}

function playerFor(name: SoundName): AudioPlayer | null {
  let entry = players.get(name);
  if (!entry) {
    try {
      const size = POOL_SIZE[name] ?? 1;
      entry = { list: Array.from({ length: size }, () => createAudioPlayer(SOURCES[name])), next: 0 };
      players.set(name, entry);
    } catch {
      return null;
    }
  }
  const player = entry.list[entry.next];
  entry.next = (entry.next + 1) % entry.list.length;
  return player;
}

export function play(name: SoundName, volume = 1) {
  if (!useGame.getState().settings.sound) return;
  const player = playerFor(name);
  if (!player) return;
  try {
    player.volume = volume;
    void player.seekTo(0);
    player.play();
  } catch {
    // A missing or interrupted sound must never break the game.
  }
}

/** Warm up the players used in the first seconds of a workout. */
export function preload(names: SoundName[]) {
  for (const name of names) playerFor(name);
}

export function startAmbience() {
  const settings = useGame.getState().settings;
  if (!settings.sound || !settings.ambience) return;
  try {
    if (!ambience) {
      ambience = createAudioPlayer(AMBIENCE);
      ambience.loop = true;
      ambience.volume = 0.35;
    }
    ambience.play();
  } catch {
    // ignore
  }
}

export function stopAmbience() {
  try {
    ambience?.pause();
  } catch {
    // ignore
  }
}

export const lootSound = (rarity: string): SoundName =>
  rarity === 'legendary' ? 'lootLegendary' : rarity === 'epic' ? 'lootEpic' : rarity === 'rare' ? 'lootRare' : 'coin';
