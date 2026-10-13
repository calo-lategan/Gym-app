import { Asset } from 'expo-asset';

import type { HeroClass } from '@/domain/types';
import type { MonsterKind } from '@/domain/game/dungeon';

/* eslint-disable @typescript-eslint/no-require-imports */
export const MODELS = {
  heroes: {
    knight: require('@/assets/models/hero-knight.glb'),
    barbarian: require('@/assets/models/hero-barbarian.glb'),
    mage: require('@/assets/models/hero-mage.glb'),
    rogue: require('@/assets/models/hero-rogue.glb'),
  } satisfies Record<HeroClass, number>,
  monsters: {
    skeleton_minion: require('@/assets/models/skeleton-minion.glb'),
    skeleton_rogue: require('@/assets/models/skeleton-rogue.glb'),
    skeleton_mage: require('@/assets/models/skeleton-mage.glb'),
    skeleton_warrior: require('@/assets/models/skeleton-warrior.glb'),
  } satisfies Record<MonsterKind, number>,
  heroAnims: require('@/assets/models/anims-hero.glb'),
  skeletonAnims: require('@/assets/models/anims-skeleton.glb'),
  dungeon: require('@/assets/models/dungeon.glb'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Loader input for a bundled model. Native loaders (patched by
 * @react-three/fiber/native) accept the module id directly; in the browser
 * the module resolves to a URL.
 */
export function modelUrl(module: number): string {
  if (process.env.EXPO_OS === 'web') return Asset.fromModule(module).uri;
  return module as unknown as string;
}
