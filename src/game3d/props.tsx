import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { createRng } from '@/domain/rng';

import { MODELS } from './assets';
import { Embers, getGlowTexture, Glow, TorchLight } from './effects';
import { useDungeonPieces } from './models';

/** A dungeon prop cloned by name from the merged model. */
export function Prop({
  piece,
  position,
  rotationY = 0,
  scale = 1,
}: {
  piece: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const pieces = useDungeonPieces(MODELS.dungeon);
  const object = useMemo(() => {
    const source = pieces.get(piece);
    return source ? source.clone(true) : null;
  }, [pieces, piece]);
  if (!object) return null;
  return <primitive object={object} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

/** Rest-day campfire: crossed logs, a flickering light and rising sparks. */
export function Campfire({ position }: { position: [number, number, number] }) {
  const logMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#4a2f1d' }), []);
  const stoneMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: '#57534b' }), []);
  const flame = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.elapsedTime;
    flame.current.scale.setScalar(1 + 0.08 * Math.sin(t * 9) + 0.05 * Math.sin(t * 17));
  });
  return (
    <group position={position}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={`s${i}`} position={[Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75]} material={stoneMaterial}>
            <dodecahedronGeometry args={[0.2, 0]} />
          </mesh>
        );
      })}
      {[0, 1, 2].map((i) => (
        <mesh key={`l${i}`} position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, (i / 3) * Math.PI]} material={logMaterial}>
          <cylinderGeometry args={[0.09, 0.11, 1.1, 6]} />
        </mesh>
      ))}
      <group ref={flame} position={[0, 0.45, 0]}>
        <Glow color="#ffb347" size={1.4} opacity={0.9} />
        <Glow color="#ff6a2a" size={2.4} opacity={0.45} />
      </group>
      <TorchLight position={[0, 0.9, 0]} color="#ff9a3d" intensity={30} distance={11} seed={5} />
      <Embers count={40} color="#ffae52" spread={0.6} height={3.2} size={0.09} speed={1.1} seed={11} />
    </group>
  );
}

/**
 * Treasure chest whose lid swings open when `open` is true. Uses the KayKit
 * chest, which has the lid as a separate hinged node.
 */
export function Chest({
  position,
  rotationY = 0,
  open,
  gold = false,
  glowColor,
}: {
  position: [number, number, number];
  rotationY?: number;
  open: boolean;
  gold?: boolean;
  glowColor?: string;
}) {
  const pieces = useDungeonPieces(MODELS.dungeon);
  const { object, lid } = useMemo(() => {
    const source = pieces.get(gold ? 'chest_gold' : 'chest');
    const clone = source ? source.clone(true) : new THREE.Group();
    let lidNode: THREE.Object3D | null = null;
    clone.traverse((o) => {
      if (o.name.includes('lid')) lidNode = o;
    });
    return { object: clone, lid: lidNode as THREE.Object3D | null };
  }, [pieces, gold]);
  const angle = useRef(0);
  const lidRef = useRef<THREE.Object3D | null>(null);
  useEffect(() => {
    lidRef.current = lid;
  }, [lid]);
  useFrame((_, delta) => {
    const node = lidRef.current;
    if (!node) return;
    const target = open ? -1.9 : 0;
    angle.current += (target - angle.current) * Math.min(1, delta * 6);
    node.rotation.x = angle.current;
  });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={object} />
      {open && glowColor ? (
        <>
          <Glow position={[0, 1.1, 0]} color={glowColor} size={2.6} opacity={0.55} />
          <pointLight position={[0, 1.6, 0.6]} color={glowColor} intensity={9} distance={6} decay={1.6} />
        </>
      ) : null}
    </group>
  );
}

/** Vertical pillar of light over dropped loot, colored by rarity. */
export function LootBeam({ position, color, height = 9 }: { position: [number, number, number]; color: string; height?: number }) {
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return m;
  }, [color]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const beam = ref.current;
    if (!beam) return;
    const t = clock.elapsedTime;
    beam.rotation.y = t * 0.8;
    (beam.material as THREE.MeshBasicMaterial).opacity = 0.28 + 0.1 * Math.sin(t * 4);
  });
  return (
    <group position={position}>
      <mesh ref={ref} position={[0, height / 2, 0]} material={material}>
        <cylinderGeometry args={[0.45, 0.9, height, 16, 1, true]} />
      </mesh>
      <Glow position={[0, 0.4, 0]} color={color} size={3.4} opacity={0.75} />
      <Embers count={30} color={color} spread={1.2} height={height * 0.7} size={0.12} speed={1.6} seed={19} />
    </group>
  );
}

/** Coins that burst out of a point and rain back down. Restart by changing `burstKey`. */
export function CoinBurst({ position, count = 24, burstKey }: { position: [number, number, number]; count?: number; burstKey: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const coins = useRef<{ v: THREE.Vector3; p: THREE.Vector3; spin: number }[]>([]);
  const dummy = useRef<THREE.Object3D | null>(null);
  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#ffcf4a', emissive: new THREE.Color('#a86a00'), emissiveIntensity: 0.6 }),
    [],
  );
  const started = useRef(0);
  const lastKey = useRef(-1);
  useFrame(({ clock }, delta) => {
    const instances = mesh.current;
    if (!instances) return;
    if (lastKey.current !== burstKey) {
      lastKey.current = burstKey;
      started.current = clock.elapsedTime;
      const rand = createRng(burstKey * 7919 + 13);
      coins.current = Array.from({ length: count }, () => ({
        v: new THREE.Vector3((rand() - 0.5) * 4.5, 5 + rand() * 4, (rand() - 0.5) * 3 + 1.5),
        p: new THREE.Vector3(0, 0.8, 0),
        spin: rand() * 10,
      }));
    }
    dummy.current ??= new THREE.Object3D();
    const d = dummy.current;
    const age = clock.elapsedTime - started.current;
    coins.current.forEach((c, i) => {
      if (age < 2.6) {
        c.v.y -= 14 * delta;
        c.p.addScaledVector(c.v, delta);
        if (c.p.y < 0.05) {
          c.p.y = 0.05;
          c.v.y *= -0.35;
          c.v.x *= 0.7;
          c.v.z *= 0.7;
        }
      }
      d.position.copy(c.p);
      d.rotation.set(c.spin + age * 8, age * 5, 0);
      // Before the first burst every coin is scaled to nothing.
      d.scale.setScalar(burstKey === 0 ? 0 : age < 3.2 ? 1 : Math.max(0, 1 - (age - 3.2) * 2));
      d.updateMatrix();
      instances.setMatrixAt(i, d.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={position}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} material={material} frustumCulled={false}>
        <cylinderGeometry args={[0.16, 0.16, 0.05, 10]} />
      </instancedMesh>
    </group>
  );
}

/** Expanding golden ring on the floor for level ups and victories. */
export function ShockRing({ position, color = '#ffc566', ringKey }: { position: [number, number, number]; color?: string; ringKey: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color],
  );
  const started = useRef<number | null>(null);
  const last = useRef(-1);
  useFrame(({ clock }) => {
    const ring = ref.current;
    if (!ring) return;
    if (last.current !== ringKey) {
      last.current = ringKey;
      started.current = clock.elapsedTime;
    }
    const age = started.current === null ? 99 : clock.elapsedTime - started.current;
    const s = 0.5 + age * 9;
    ring.scale.set(s, s, 1);
    (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age * 1.1);
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <ringGeometry args={[0.42, 0.5, 48]} />
    </mesh>
  );
}
