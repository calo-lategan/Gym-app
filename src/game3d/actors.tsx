import { useMemo } from 'react';

import type { MonsterKind } from '@/domain/game/dungeon';
import type { Hero } from '@/domain/types';
import { rarityColors } from '@/theme';

import { MODELS } from './assets';
import { BlobShadow, Embers } from './effects';
import { heroLoadout } from './loadout';
import { Character, type OneShot } from './models';

export function HeroModel({
  hero,
  action,
  oneShot,
  resting,
  position,
  rotation,
  scale = 1,
  onPointerDown,
  onOneShotEnd,
}: {
  hero: Hero;
  action?: string;
  oneShot?: OneShot | null;
  resting?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onPointerDown?: () => void;
  onOneShotEnd?: (name: string) => void;
}) {
  const loadout = useMemo(() => heroLoadout(hero, { resting }), [hero, resting]);
  const visible = useMemo(() => (name: string) => loadout.visible.has(name), [loadout]);
  const glow =
    loadout.weaponRarity && loadout.weaponRarity !== 'common'
      ? { meshes: loadout.weaponMeshes, color: rarityColors[loadout.weaponRarity], intensity: loadout.weaponRarity === 'uncommon' ? 0.25 : 0.6 }
      : null;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <BlobShadow />
      <Character
        model={MODELS.heroes[hero.heroClass]}
        animations={[MODELS.heroAnims]}
        action={action ?? loadout.idle}
        oneShot={oneShot}
        visible={visible}
        glow={glow}
        onPointerDown={onPointerDown}
        onOneShotEnd={onOneShotEnd}
      />
      {loadout.auraColor ? <Embers count={22} color={loadout.auraColor} spread={1.4} height={2.6} size={0.08} speed={0.55} seed={7} /> : null}
    </group>
  );
}

export function MonsterModel({
  kind,
  action = 'Idle_Combat',
  oneShot,
  position,
  rotation,
  scale = 1,
  boss = false,
  holdAction = false,
  onOneShotEnd,
}: {
  kind: MonsterKind;
  holdAction?: boolean;
  action?: string;
  oneShot?: OneShot | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  boss?: boolean;
  onOneShotEnd?: (name: string) => void;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <BlobShadow radius={boss ? 1.2 : 0.9} />
      <Character
        model={MODELS.monsters[kind]}
        animations={[MODELS.skeletonAnims]}
        action={action}
        holdAction={holdAction}
        oneShot={oneShot}
        emissive={boss ? '#5a0d06' : undefined}
        emissiveIntensity={boss ? 0.9 : undefined}
        onOneShotEnd={onOneShotEnd}
      />
      {boss ? <Embers count={26} color="#ff5a3c" spread={1.6} height={3} size={0.1} speed={0.7} seed={3} /> : null}
    </group>
  );
}
