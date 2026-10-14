import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { zoneForFloor } from '@/domain/game/dungeon';
import type { Hero } from '@/domain/types';

import { HeroModel } from '../actors';
import { GameCanvas } from '../canvas';
import { DungeonRoom, roomLayout, SceneAtmosphere } from '../dungeon-room';
import { CameraRig, Embers, getGlowTexture } from '../effects';
import type { OneShot } from '../models';
import { Chest, CoinBurst, LootBeam, ShockRing } from '../props';

// Portrait framing: far enough back that hero and chest both fit the width,
// aimed low so the pair sits between the title and the reward card.
const CAM: [number, number, number] = [0.1, 5.2, 14];
const TARGET: [number, number, number] = [0.05, 0.25, 0];
const HERO_POS: [number, number, number] = [-0.9, 0, 0.6];
const CHEST_POS: [number, number, number] = [0.85, 0, 0.8];

/** A column of light that flares around the hero and fades, for level ups. */
function AscensionPillar({ pillarKey, color, position }: { pillarKey: number; color: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const started = useRef<number | null>(null);
  const last = useRef(pillarKey);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(1.1),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [color],
  );
  const haloMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: new THREE.Color(color).multiplyScalar(1.8),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color],
  );
  useFrame(({ clock }) => {
    if (last.current !== pillarKey) {
      last.current = pillarKey;
      started.current = clock.elapsedTime;
    }
    const age = started.current === null ? 99 : clock.elapsedTime - started.current;
    // Snap in, hold, then fade over two seconds.
    const strength = age < 0.12 ? age / 0.12 : Math.max(0, 1 - (age - 0.6) / 1.8);
    const column = ref.current;
    if (column) {
      (column.material as THREE.MeshBasicMaterial).opacity = 0.32 * strength;
      column.rotation.y = clock.elapsedTime * 2.2;
      const widen = 1 + Math.min(age, 1) * 0.35;
      column.scale.set(widen, 1, widen);
    }
    const glow = halo.current;
    if (glow) {
      glow.material.opacity = 0.75 * strength;
      const s = 2.4 + Math.sin(clock.elapsedTime * 10) * 0.15 + Math.min(age, 0.4) * 4;
      glow.scale.set(s, s, 1);
    }
  });
  return (
    <group position={position}>
      <mesh ref={ref} position={[0, 5, 0]} material={material}>
        <cylinderGeometry args={[0.55, 0.85, 10, 20, 1, true]} />
      </mesh>
      <sprite ref={halo} position={[0, 1.2, 0]} material={haloMaterial} />
    </group>
  );
}

export interface VictorySceneChest {
  /** Changes for each chest so the lid starts closed again. */
  key: number;
  open: boolean;
  /** Rarity color of what is inside, shown once the lid is up. */
  color: string | null;
  gold: boolean;
}

export interface VictorySceneProps {
  hero: Hero;
  floor: number;
  /** False when the workout fell short: no cheering, no treasure. */
  triumphant: boolean;
  cheerKey: number;
  ringKey: number;
  levelKey: number;
  coinKey: number;
  shakeKey: number;
  chest: VictorySceneChest | null;
}

/**
 * The reward room: the hero beside a treasure chest. The victory screen drives
 * it with keys, so each reward beat lands a cheer, a shock ring, a pillar of
 * light, a coin burst or a loot beam in sync with its sound.
 */
export function VictoryScene({ hero, floor, triumphant, cheerKey, ringKey, levelKey, coinKey, shakeKey, chest }: VictorySceneProps) {
  const zone = zoneForFloor(floor);
  const layout = useMemo(() => {
    const pieces = roomLayout({ gate: 'open', variant: floor + 2 });
    // The camera sits far back, so carry the floor out under it.
    for (const z of [2, 3]) for (let x = -1; x <= 1; x++) pieces.push({ piece: 'floor_tile_large', position: [x * 4, 0, z * 4] });
    return pieces;
  }, [floor]);
  const [shot, setShot] = useState<OneShot | null>(null);
  const [seen, setSeen] = useState({ cheer: cheerKey, level: levelKey });

  // Each bumped key plays its animation once, decided while rendering.
  if (seen.cheer !== cheerKey || seen.level !== levelKey) {
    setSeen({ cheer: cheerKey, level: levelKey });
    if (seen.level !== levelKey && levelKey !== 0) setShot((s) => ({ name: 'Spellcast_Raise', key: (s?.key ?? 0) + 1, speed: 1.1 }));
    else if (seen.cheer !== cheerKey && cheerKey !== 0) setShot((s) => ({ name: triumphant ? 'Cheer' : 'Interact', key: (s?.key ?? 0) + 1 }));
  }

  return (
    <GameCanvas camera={{ position: CAM, fov: 40 }}>
      <CameraRig position={CAM} target={TARGET} shakeKey={shakeKey} shakeStrength={0.22} sway={0.1} />
      <SceneAtmosphere fog={zone.fog} near={8} far={22} />
      <Suspense fallback={null}>
        <DungeonRoom layout={layout} torchColor={zone.light} />
        <HeroModel hero={hero} oneShot={shot} position={HERO_POS} rotation={[0, 0.42, 0]} />
        {chest ? (
          <Chest key={chest.key} position={CHEST_POS} rotationY={-0.55} open={chest.open} gold={chest.gold} glowColor={chest.color ?? undefined} />
        ) : null}
        {chest?.open && chest.color ? <LootBeam position={CHEST_POS} color={chest.color} height={8} /> : null}
        <CoinBurst position={CHEST_POS} burstKey={coinKey} count={30} />
        <ShockRing position={[HERO_POS[0], 0.06, HERO_POS[2]]} ringKey={ringKey} />
        <AscensionPillar pillarKey={levelKey} color="#ffc566" position={HERO_POS} />
        {levelKey > 0 ? (
          <group position={HERO_POS}>
            <Embers key={levelKey} count={40} color="#ffd36b" spread={1.2} height={4} size={0.1} speed={1.8} seed={levelKey} />
          </group>
        ) : null}
        <Embers count={30} spread={10} height={6} color={zone.light} size={0.07} speed={0.25} seed={4} />
      </Suspense>
    </GameCanvas>
  );
}
