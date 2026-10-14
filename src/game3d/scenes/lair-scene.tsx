import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

import type { Hero } from '@/domain/types';

import { HeroModel } from '../actors';
import { GameCanvas } from '../canvas';
import { DungeonRoom, SceneAtmosphere, type PropPlacement } from '../dungeon-room';
import { CameraRig, Embers, Glow } from '../effects';
import { Dragon, paletteForTier } from '../dragon';
import type { OneShot } from '../models';

const CAM: [number, number, number] = [0.6, 3.3, 12.5];
const TARGET: [number, number, number] = [0, 2.0, -2.6];
const DRAGON_POS: [number, number, number] = [0, 0, -3.6];

/** The dragon's hall: a deep chamber with its hoard spread across the floor. */
function lairLayout(): PropPlacement[] {
  const pieces: PropPlacement[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let z = -2; z <= 3; z++) {
      pieces.push({ piece: (x + z) % 2 === 0 ? 'floor_dirt_large_rocky' : 'floor_tile_large', position: [x * 4, 0, z * 4] });
    }
  }
  pieces.push({ piece: 'wall_pillar', position: [-4, 0, -10] });
  pieces.push({ piece: 'wall_arched', position: [0, 0, -10] });
  pieces.push({ piece: 'wall_pillar', position: [4, 0, -10] });
  pieces.push({ piece: 'wall', position: [-4, 4, -10] });
  pieces.push({ piece: 'wall_broken', position: [0, 4, -10] });
  pieces.push({ piece: 'wall', position: [4, 4, -10] });
  for (const z of [-8, -4, 0]) {
    pieces.push({ piece: z === -4 ? 'wall_cracked' : 'wall', position: [-6, 0, z], rotationY: Math.PI / 2 });
    pieces.push({ piece: z === 0 ? 'wall_arched' : 'wall', position: [6, 0, z], rotationY: -Math.PI / 2 });
    pieces.push({ piece: 'wall', position: [-6, 4, z], rotationY: Math.PI / 2 });
    pieces.push({ piece: 'wall', position: [6, 4, z], rotationY: -Math.PI / 2 });
  }
  pieces.push({ piece: 'torch_mounted', position: [-2.4, 2.4, -9.5] });
  pieces.push({ piece: 'torch_mounted', position: [2.4, 2.4, -9.5] });
  pieces.push({ piece: 'pillar_decorated', position: [-4.4, 0, -6.4] });
  pieces.push({ piece: 'pillar_decorated', position: [4.4, 0, -6.4] });
  pieces.push({ piece: 'pillar', position: [-4.6, 0, -1.6] });
  pieces.push({ piece: 'pillar', position: [4.6, 0, -1.6] });
  // The hoard.
  pieces.push({ piece: 'coin_stack_large', position: [-2.3, 0, -3.0], rotationY: 0.3 });
  pieces.push({ piece: 'coin_stack_large', position: [2.5, 0, -2.4], rotationY: -0.6 });
  pieces.push({ piece: 'coin_stack_large', position: [-1.4, 0, -6.2] });
  pieces.push({ piece: 'coin_stack_small', position: [1.5, 0, -5.6] });
  pieces.push({ piece: 'coin_stack_small', position: [-3.1, 0, -1.2], rotationY: 1.1 });
  pieces.push({ piece: 'coin_stack_small', position: [3.3, 0, -0.9] });
  pieces.push({ piece: 'coin', position: [1.2, 0, -1.2] });
  pieces.push({ piece: 'coin', position: [-0.9, 0, -0.6] });
  pieces.push({ piece: 'chest_gold', position: [3.2, 0, -4.6], rotationY: -0.5 });
  pieces.push({ piece: 'sword_shield_gold', position: [-3.4, 0, -4.4], rotationY: 0.6 });
  pieces.push({ piece: 'candle_triple', position: [-4.2, 0, -8.2] });
  pieces.push({ piece: 'candle_triple', position: [4.0, 0, -8.4] });
  pieces.push({ piece: 'rubble_large', position: [4.6, 0, 2.2], rotationY: 0.8 });
  pieces.push({ piece: 'rubble_half', position: [-4.8, 0, 2.6], rotationY: -0.4 });
  return pieces;
}

/** Eases its children toward a target position, for the hero's charge. */
function Mover({ to, children }: { to: [number, number, number]; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const [initial] = useState(to);
  const target = useMemo(() => new THREE.Vector3(...to), [to]);
  useFrame((_, delta) => {
    ref.current?.position.lerp(target, 1 - Math.pow(0.05, delta));
  });
  return (
    <group ref={ref} position={initial}>
      {children}
    </group>
  );
}

export interface LairSceneProps {
  hero: Hero;
  tier: number;
  health: number;
  roarKey: number;
  hurtKey: number;
  dead: boolean;
  shakeKey: number;
  heroAction?: string;
  heroShot?: OneShot | null;
  /** Where the hero stands; changing it makes them charge. */
  heroAt: [number, number, number];
  onDragonTap?: () => void;
}

export const HERO_START: [number, number, number] = [-1.5, 0, 3.6];
export const HERO_STRIKE: [number, number, number] = [-0.6, 0, -0.2];

export function LairScene({ hero, tier, health, roarKey, hurtKey, dead, shakeKey, heroAction, heroShot, heroAt, onDragonTap }: LairSceneProps) {
  const layout = useMemo(() => lairLayout(), []);
  const palette = paletteForTier(tier);
  return (
    <GameCanvas camera={{ position: CAM, fov: 52 }}>
      <CameraRig position={CAM} target={TARGET} shakeKey={shakeKey} shakeStrength={0.4} sway={0.12} />
      <SceneAtmosphere fog="#120807" near={12} far={32} />
      <Suspense fallback={null}>
        <DungeonRoom layout={layout} torchColor="#ff8a3d" />
        <Dragon tier={tier} position={DRAGON_POS} scale={1.2} health={health} roarKey={roarKey} hurtKey={hurtKey} dead={dead} onPointerDown={onDragonTap} />
        <Mover to={heroAt}>
          <HeroModel hero={hero} action={heroAction} oneShot={heroShot} rotation={[0, Math.PI + 0.3, 0]} />
        </Mover>
        {/* Hoard glow and the dragon's own light. */}
        <pointLight position={[0, 1.2, -2.2]} color="#ffb347" intensity={16} distance={9} decay={1.6} />
        <pointLight position={[0, 4.5, -1]} color={palette.glow} intensity={dead ? 4 : 14} distance={12} decay={1.5} />
        <Glow position={[-2.3, 0.5, -3.0]} color="#ffc95e" size={2.2} opacity={0.35} />
        <Glow position={[2.5, 0.5, -2.4]} color="#ffc95e" size={2.2} opacity={0.35} />
        <Embers count={50} spread={11} height={8} color={palette.glow} size={0.08} speed={0.35} seed={9} />
      </Suspense>
    </GameCanvas>
  );
}
