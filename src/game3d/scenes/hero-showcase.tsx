import { useFrame } from '@react-three/fiber';
import { Suspense, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

import type { Hero } from '@/domain/types';
import { play } from '@/services/sound';

import { HeroModel } from '../actors';
import { GameCanvas } from '../canvas';
import { CameraRig, Embers, Glow, TorchLight } from '../effects';
import { Prop } from '../props';

function Turntable({ children, speed = 0.35 }: { children: ReactNode; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed;
  });
  return <group ref={ref}>{children}</group>;
}

/** A spotlit pedestal that slowly turns the hero, used for onboarding and the hero sheet. */
export function HeroShowcase({ hero, spin = true }: { hero: Hero; spin?: boolean }) {
  const [shot, setShot] = useState<{ name: string; key: number } | null>(null);
  return (
    <GameCanvas camera={{ position: [0, 2.6, 6.4], fov: 38 }}>
      <CameraRig position={[0, 2.6, 6.4]} target={[0, 1.25, 0]} sway={0.05} />
      <color attach="background" args={['#0B1110']} />
      <fog attach="fog" args={['#0B1110', 7, 14]} />
      <hemisphereLight args={['#8090b0', '#1a120a', 0.7]} />
      <pointLight position={[0, 5, 3.5]} intensity={40} distance={14} decay={1.5} color="#ffd9a8" />
      <pointLight position={[-3, 2, -3]} intensity={18} distance={10} decay={1.5} color="#6f9dff" />
      <Suspense fallback={null}>
        <Prop piece="floor_tile_small_decorated" position={[0, -0.6, 0]} scale={1.3} />
        <Turntable speed={spin ? 0.35 : 0}>
          <HeroModel
            hero={hero}
            oneShot={shot}
            onPointerDown={() => {
              play('streak', 0.4);
              setShot((s) => ({ name: 'Cheer', key: (s?.key ?? 0) + 1 }));
            }}
          />
        </Turntable>
        <TorchLight position={[2.2, 2.2, -1.5]} intensity={14} seed={4} />
        <Glow position={[0, 0.05, 0]} color="#f2a93b" size={3.6} opacity={0.25} />
        <Embers count={30} spread={4} height={4} color="#ffb45e" size={0.07} speed={0.4} seed={9} />
      </Suspense>
    </GameCanvas>
  );
}
