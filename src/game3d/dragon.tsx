import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { createRng } from '@/domain/rng';

import { getGlowTexture } from './effects';

type V3 = [number, number, number];

export interface DragonPalette {
  body: string;
  belly: string;
  horn: string;
  membrane: string;
  glow: string;
}

/** One look per dragon in the cycle: ash and ember, storm, hollow flame, mountain. */
export const DRAGON_PALETTES: DragonPalette[] = [
  { body: '#4b4340', belly: '#c27a3e', horn: '#e2d6bd', membrane: '#7a2a1c', glow: '#ff6a2a' },
  { body: '#214a63', belly: '#cdb682', horn: '#ece6d6', membrane: '#173247', glow: '#66d2ff' },
  { body: '#43265c', belly: '#b893cf', horn: '#e6dcf2', membrane: '#2c1840', glow: '#c58aff' },
  { body: '#4a5730', belly: '#c9a86c', horn: '#ece0c4', membrane: '#2f381d', glow: '#ffd36b' },
];

export const paletteForTier = (tier: number) => DRAGON_PALETTES[(Math.max(1, tier) - 1) % DRAGON_PALETTES.length];

const lambert = (color: string, side: THREE.Side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color, flatShading: true, side });

/** A tapered cylinder between two points. */
function Limb({ from, to, r1, r2, material, segments = 7 }: { from: V3; to: V3; r1: number; r2: number; material: THREE.Material; segments?: number }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const length = dir.length();
  const position = a.add(b).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return (
    <mesh position={position} quaternion={quaternion} material={material}>
      <cylinderGeometry args={[r2, r1, length, segments]} />
    </mesh>
  );
}

const WING = {
  shoulder: new THREE.Vector3(0, 0, 0),
  elbow: new THREE.Vector3(1.5, 0.85, -0.35),
  tips: [new THREE.Vector3(3.4, 1.55, -0.9), new THREE.Vector3(3.2, 0.25, -1.3), new THREE.Vector3(2.5, -0.65, -1.4), new THREE.Vector3(1.45, -0.75, -1.15)],
  base: new THREE.Vector3(0.15, -0.55, -0.95),
};

/** Bat-wing membrane fanned from the elbow, scalloped between the fingers. */
function wingGeometry(): THREE.BufferGeometry {
  const { shoulder, elbow, tips, base } = WING;
  const scallop = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().lerp(b, 0.5).lerp(elbow, 0.3);
  const ring = [tips[0], scallop(tips[0], tips[1]), tips[1], scallop(tips[1], tips[2]), tips[2], scallop(tips[2], tips[3]), tips[3], base, shoulder];
  const positions: number[] = [];
  for (let i = 0; i < ring.length - 1; i++) positions.push(...elbow.toArray(), ...ring[i].toArray(), ...ring[i + 1].toArray());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function Wing({ membrane, bone }: { membrane: THREE.Material; bone: THREE.Material }) {
  const geometry = useMemo(() => wingGeometry(), []);
  const { shoulder, elbow, tips } = WING;
  return (
    <group>
      <mesh geometry={geometry} material={membrane} />
      <Limb from={shoulder.toArray() as V3} to={elbow.toArray() as V3} r1={0.13} r2={0.09} material={bone} />
      {tips.map((t, i) => (
        <Limb key={i} from={elbow.toArray() as V3} to={t.toArray() as V3} r1={0.07} r2={0.025} material={bone} segments={5} />
      ))}
      <mesh position={tips[0].toArray() as V3} rotation={[0, 0, -0.6]} material={bone}>
        <coneGeometry args={[0.07, 0.35, 5]} />
      </mesh>
    </group>
  );
}

/**
 * A crystal ward around the dragon made of separate shards. Shards drop away
 * as the lifter closes in on their goal; at zero health nothing is left.
 */
function Ward({ health, color, radius }: { health: number; color: string; radius: number }) {
  const shards = useMemo(() => {
    const source = new THREE.IcosahedronGeometry(radius, 3).toNonIndexed();
    const pos = source.getAttribute('position');
    const tris: number[][] = [];
    for (let i = 0; i < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
      const center = a.clone().add(b).add(c).divideScalar(3);
      // Shrink each face toward its center so the ward reads as separate plates.
      tris.push([a, b, c].flatMap((v) => v.lerp(center, 0.12).toArray()));
    }
    // Deterministic shuffle so shards fall in a scattered order.
    const rand = createRng(1337);
    for (let i = tris.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [tris[i], tris[j]] = [tris[j], tris[i]];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    geometry.computeVertexNormals();
    return { geometry, count: tris.length };
  }, [radius]);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(0.9),
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [color],
  );
  const ref = useRef<THREE.Mesh>(null);
  const visible = Math.round(shards.count * Math.max(0, Math.min(1, health)));
  useFrame(({ clock }) => {
    const ward = ref.current;
    if (!ward) return;
    const t = clock.elapsedTime;
    ward.geometry.setDrawRange(0, visible * 3);
    ward.rotation.y = t * 0.08;
    ward.rotation.x = Math.sin(t * 0.13) * 0.05;
    (ward.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.05 * Math.sin(t * 2.1);
  });
  if (visible === 0) return null;
  return <mesh ref={ref} geometry={shards.geometry} material={material} />;
}

export interface DragonProps {
  tier: number;
  position?: V3;
  rotationY?: number;
  scale?: number;
  /** 0 to 1. The ward shrinks with it. */
  health: number;
  /** Bump to make the dragon rear up and roar. */
  roarKey?: number;
  /** Bump when the dragon is struck. */
  hurtKey?: number;
  dead?: boolean;
  onPointerDown?: () => void;
}

/**
 * The goal dragon, built from simple shapes so it costs nothing to download.
 * It breathes, sways and flexes its wings; roars rear the head and open the
 * jaw with fire in the throat; death topples it onto its side.
 */
export function Dragon({ tier, position = [0, 0, 0], rotationY = 0, scale = 1, health, roarKey = 0, hurtKey = 0, dead = false, onPointerDown }: DragonProps) {
  const palette = paletteForTier(tier);
  const m = useMemo(
    () => ({
      body: lambert(palette.body),
      belly: lambert(palette.belly),
      horn: lambert(palette.horn),
      membrane: lambert(palette.membrane, THREE.DoubleSide),
      dark: lambert('#1a1412'),
      eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.glow).multiplyScalar(1.6) }),
      glow: new THREE.SpriteMaterial({ map: getGlowTexture(), color: palette.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }),
      fire: new THREE.SpriteMaterial({ map: getGlowTexture(), color: new THREE.Color(palette.glow).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
    }),
    [palette],
  );

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const neck = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const fireLight = useRef<THREE.PointLight>(null);
  const fireSprite = useRef<THREE.Sprite>(null);

  const live = useRef<typeof m | null>(null);
  useEffect(() => {
    live.current = m;
  }, [m]);

  const timing = useRef({ roarKey, roarAt: -99, hurtKey, hurtAt: -99, deadAt: dead ? -99 : null as number | null });

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = timing.current;
    if (s.roarKey !== roarKey) {
      s.roarKey = roarKey;
      s.roarAt = t;
    }
    if (s.hurtKey !== hurtKey) {
      s.hurtKey = hurtKey;
      s.hurtAt = t;
    }
    if (dead && s.deadAt === null) s.deadAt = t;
    if (!dead) s.deadAt = null;

    const roarAge = t - s.roarAt;
    const roar = roarAge < 2 ? Math.sin(Math.min(1, roarAge / 2) * Math.PI) : 0;
    const hurtAge = t - s.hurtAt;
    const hurt = hurtAge < 0.6 ? Math.sin((hurtAge / 0.6) * Math.PI) : 0;
    const death = s.deadAt === null ? 0 : Math.min(1, (t - s.deadAt) / 1.8);
    const fall = death * death * (3 - 2 * death);
    const alive = 1 - fall;

    if (root.current) {
      root.current.rotation.z = fall * 1.25;
      root.current.position.y = position[1] - fall * 0.35;
    }
    if (body.current) {
      const breathe = Math.sin(t * 1.6) * alive;
      body.current.scale.set(1 + breathe * 0.015, 1 + breathe * 0.03, 1);
      body.current.rotation.x = -hurt * 0.18 - roar * 0.12;
      body.current.position.y = 1.35 + breathe * 0.03 + roar * 0.12;
    }
    neck.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.z = Math.sin(t * 0.7 + i * 0.4) * 0.05 * alive;
      g.rotation.x = (i === 0 ? 0.5 : -0.15) - roar * 0.12 - hurt * 0.1 + fall * 0.25;
    });
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.5) * 0.18 * alive;
      head.current.rotation.x = -roar * 0.45 + hurt * 0.25 + fall * 0.4;
    }
    if (jaw.current) jaw.current.rotation.x = 0.06 + roar * 0.6 + hurt * 0.25 + fall * 0.35;
    const flap = Math.sin(t * 1.1) * 0.1 * alive;
    if (wingL.current) {
      wingL.current.rotation.z = 0.25 + flap + roar * 0.55 - fall * 0.6;
      wingL.current.rotation.y = -0.55 + roar * 0.45;
    }
    if (wingR.current) {
      wingR.current.rotation.z = -(0.25 + flap + roar * 0.55) + fall * 0.2;
      wingR.current.rotation.y = 0.55 - roar * 0.45;
    }
    tail.current.forEach((g, i) => {
      if (g) g.rotation.y = 0.2 + Math.sin(t * 1.3 - i * 0.7) * 0.12 * alive + roar * 0.08;
    });
    const fire = Math.max(roar, hurt * 0.3) * alive;
    if (fireLight.current) fireLight.current.intensity = fire * 30;
    if (fireSprite.current) {
      fireSprite.current.material.opacity = fire;
      const size = 0.6 + fire * 1.6;
      fireSprite.current.scale.set(size, size, 1);
    }
    const mats = live.current;
    if (mats) {
      mats.eye.color.set(palette.glow).multiplyScalar(1.6 * (1 - fall * 0.85));
      mats.glow.opacity = 0.85 * (1 - fall);
    }
  });

  const neckRadii = [0.44, 0.39, 0.35, 0.31];
  const tailRadii = [0.38, 0.32, 0.27, 0.22, 0.17, 0.13, 0.09];
  const spikes = [1.0, 0.55, 0.1, -0.35, -0.8, -1.2];

  // Nested groups so each joint rotates its children, like a rig.
  const neckChain = neckRadii.reduceRight<React.ReactNode>(
    (child, r, i) => (
      <group
        ref={(g) => {
          neck.current[i] = g;
        }}
        position={i === 0 ? [0, 0.6, 1.0] : [0, 0.42, 0]}
        rotation={[i === 0 ? 0.5 : -0.15, 0, 0]}
      >
        <mesh material={m.body} scale={[1, 1.15, 1]}>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
        <mesh material={m.belly} position={[0, 0, r * 0.62]} scale={[0.7, 1.1, 0.45]}>
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
        <mesh material={m.horn} position={[0, 0.05, -r * 0.9]} rotation={[-0.9, 0, 0]}>
          <coneGeometry args={[0.07, 0.28, 4]} />
        </mesh>
        {child}
      </group>
    ),
    <group ref={head} position={[0, 0.4, 0.05]} scale={1.3}>
      <mesh material={m.body} position={[0, 0.15, 0.05]} scale={[0.95, 0.78, 1.05]}>
        <icosahedronGeometry args={[0.5, 1]} />
      </mesh>
      <mesh material={m.body} position={[0, 0.1, 0.62]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.56, 0.3, 0.85]} />
      </mesh>
      <mesh material={m.dark} position={[0, 0.27, 0.32]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.62, 0.1, 0.32]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={m.horn} position={[side * 0.27, 0.45, -0.18]} rotation={[-1.05, 0, -side * 0.35]}>
            <coneGeometry args={[0.1, 0.85, 5]} />
          </mesh>
          <mesh material={m.horn} position={[side * 0.42, 0.18, -0.12]} rotation={[-1.3, 0, -side * 0.9]}>
            <coneGeometry args={[0.06, 0.4, 4]} />
          </mesh>
          <mesh material={m.eye} position={[side * 0.24, 0.26, 0.44]}>
            <icosahedronGeometry args={[0.075, 0]} />
          </mesh>
          <sprite material={m.glow} position={[side * 0.25, 0.27, 0.5]} scale={[0.55, 0.55, 1]} />
          <mesh material={m.horn} position={[side * 0.17, -0.08, 0.95]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.04, 0.16, 4]} />
          </mesh>
        </group>
      ))}
      <group ref={jaw} position={[0, -0.06, 0.22]}>
        <mesh material={m.belly} position={[0, -0.08, 0.38]}>
          <boxGeometry args={[0.48, 0.16, 0.8]} />
        </mesh>
      </group>
      <sprite ref={fireSprite} material={m.fire} position={[0, -0.05, 1.05]} />
      <pointLight ref={fireLight} position={[0, 0, 1.3]} color={palette.glow} intensity={0} distance={8} decay={1.5} />
    </group>,
  );

  const tailChain = tailRadii.reduceRight<React.ReactNode>(
    (child, r, i) => (
      <group
        ref={(g) => {
          tail.current[i] = g;
        }}
        position={i === 0 ? [0, -0.25, -1.35] : [0, 0, -0.46]}
      >
        <mesh material={m.body} position={[0, 0, -0.23]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r * 0.82, 0.55, 7]} />
        </mesh>
        {i % 2 === 0 ? (
          <mesh material={m.horn} position={[0, r * 0.95, -0.2]} rotation={[-0.7, 0, 0]}>
            <coneGeometry args={[r * 0.35, r * 1.1, 4]} />
          </mesh>
        ) : null}
        {child}
      </group>
    ),
    <mesh material={m.horn} position={[0, 0, -0.35]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.6, 1, 0.35]}>
      <coneGeometry args={[0.18, 0.5, 4]} />
    </mesh>,
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <group ref={root}>
        <group ref={body} position={[0, 1.35, 0]} onPointerDown={onPointerDown ? () => onPointerDown() : undefined}>
          <mesh material={m.body} scale={[1.15, 0.95, 1.55]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          <mesh material={m.belly} position={[0, -0.24, 0.34]} scale={[0.85, 0.68, 1.15]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
          {spikes.map((z, i) => (
            <mesh key={z} material={m.horn} position={[0, 0.95 * Math.sqrt(Math.max(0, 1 - (z / 1.55) ** 2)) + 0.08, z]} rotation={[-0.45, 0, 0]}>
              <coneGeometry args={[0.13 - i * 0.012, 0.42 - i * 0.03, 4]} />
            </mesh>
          ))}
          {neckChain}
          <group ref={wingL} position={[0.62, 0.62, 0.15]}>
            <Wing membrane={m.membrane} bone={m.body} />
          </group>
          <group ref={wingR} position={[-0.62, 0.62, 0.15]} scale={[-1, 1, 1]}>
            <Wing membrane={m.membrane} bone={m.body} />
          </group>
          {tailChain}
          {[-1, 1].map((side) => (
            <group key={`legs${side}`}>
              {/* Front legs */}
              <Limb from={[side * 0.72, -0.35, 0.85]} to={[side * 0.86, -0.9, 1.0]} r1={0.24} r2={0.18} material={m.body} />
              <Limb from={[side * 0.86, -0.9, 1.0]} to={[side * 0.86, -1.32, 1.12]} r1={0.17} r2={0.15} material={m.body} />
              <mesh material={m.body} position={[side * 0.86, -1.3, 1.22]} scale={[1, 0.5, 1.3]}>
                <icosahedronGeometry args={[0.2, 0]} />
              </mesh>
              {[-0.09, 0, 0.09].map((x) => (
                <mesh key={x} material={m.horn} position={[side * 0.86 + x, -1.3, 1.46]} rotation={[Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.04, 0.16, 4]} />
                </mesh>
              ))}
              {/* Hind legs */}
              <mesh material={m.body} position={[side * 0.88, -0.38, -0.75]} scale={[0.75, 1, 1.05]}>
                <icosahedronGeometry args={[0.52, 1]} />
              </mesh>
              <Limb from={[side * 0.95, -0.7, -0.6]} to={[side * 0.98, -1.32, -0.45]} r1={0.2} r2={0.16} material={m.body} />
              <mesh material={m.body} position={[side * 0.98, -1.3, -0.3]} scale={[1, 0.5, 1.35]}>
                <icosahedronGeometry args={[0.22, 0]} />
              </mesh>
            </group>
          ))}
        </group>
        <group position={[0, 1.7, 0.25]}>
          <Ward health={health} color={palette.glow} radius={3.1} />
        </group>
      </group>
    </group>
  );
}
