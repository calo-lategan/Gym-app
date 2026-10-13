import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Soft round sprite generated in code, so no image needs to load (works on native GL too). */
let glowTexture: THREE.DataTexture | null = null;
export function getGlowTexture(): THREE.DataTexture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const a = Math.pow(1 - d, 2.2);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  glowTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  glowTexture.needsUpdate = true;
  glowTexture.magFilter = THREE.LinearFilter;
  glowTexture.minFilter = THREE.LinearFilter;
  return glowTexture;
}

/** Torch light that flickers like a real flame, with a glowing flame sprite. */
export function TorchLight({
  position,
  color = '#ffb45e',
  intensity = 26,
  distance = 13,
  seed = 0,
}: {
  position: [number, number, number];
  color?: string;
  intensity?: number;
  distance?: number;
  seed?: number;
}) {
  const light = useRef<THREE.PointLight>(null);
  const flame = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.0 + seed * 13.7;
    const flicker = 0.82 + 0.1 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 13.1 + 1.3) + 0.04 * Math.sin(t * 23.9);
    if (light.current) light.current.intensity = intensity * flicker;
    if (flame.current) {
      const s = 0.8 + 0.12 * Math.sin(t * 11.0);
      flame.current.scale.set(s, s * 1.35, 1);
    }
  });
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: new THREE.Color(color).multiplyScalar(2.2),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    [color],
  );
  const halo = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: new THREE.Color(color),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.35,
      }),
    [color],
  );
  return (
    <group position={position}>
      <pointLight ref={light} color={color} intensity={intensity} distance={distance} decay={1.6} />
      <sprite scale={[2.6, 2.6, 1]} material={halo} />
      <sprite ref={flame} material={material} />
      <Embers count={14} color={color} spread={0.12} height={1.2} seed={seed} />
    </group>
  );
}

/** Rising sparks: cheap additive points that loop forever. */
export function Embers({
  count = 30,
  color = '#ffb45e',
  spread = 2,
  height = 3,
  size = 0.09,
  speed = 0.6,
  seed = 1,
}: {
  count?: number;
  color?: string;
  spread?: number;
  height?: number;
  size?: number;
  speed?: number;
  seed?: number;
}) {
  const points = useRef<THREE.Points>(null);
  const { positions, offsets } = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const positions = new Float32Array(count * 3);
    const offsets = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * spread;
      positions[i * 3 + 1] = rand() * height;
      positions[i * 3 + 2] = (rand() - 0.5) * spread;
      offsets[i * 2] = rand() * Math.PI * 2;
      offsets[i * 2 + 1] = 0.5 + rand();
    }
    return { positions, offsets };
  }, [count, spread, height, seed]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size,
        map: getGlowTexture(),
        color: new THREE.Color(color).multiplyScalar(1.4),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [color, size],
  );

  useFrame(({ clock }, delta) => {
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) + delta * speed * offsets[i * 2 + 1];
      if (y > height) y = 0;
      attr.setY(i, y);
      attr.setX(i, positions[i * 3] + Math.sin(t * 1.3 + offsets[i * 2]) * 0.05 * (1 + y));
    }
    attr.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/** Large soft halo used behind glowing things (loot, eyes, portals). */
export function Glow({
  position,
  color,
  size = 2,
  opacity = 0.6,
}: {
  position?: [number, number, number];
  color: string;
  size?: number;
  opacity?: number;
}) {
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity,
      }),
    [color, opacity],
  );
  return <sprite position={position} scale={[size, size, 1]} material={material} />;
}

/** Dark disc under a character so it sits on the floor without real-time shadows. */
export function BlobShadow({ radius = 0.9, opacity = 0.55 }: { radius?: number; opacity?: number }) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(),
        color: '#000000',
        transparent: true,
        opacity,
        depthWrite: false,
      }),
    [opacity],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={material}>
      <planeGeometry args={[radius * 2, radius * 2]} />
    </mesh>
  );
}

/**
 * Keeps the camera on a target every frame, with optional shake. Shake decays
 * on its own; bump `shakeKey` to trigger a new impact.
 */
export function CameraRig({
  position,
  target,
  shakeKey = 0,
  shakeStrength = 0.18,
  sway = 0.15,
}: {
  position: [number, number, number];
  target: [number, number, number];
  shakeKey?: number;
  shakeStrength?: number;
  sway?: number;
}) {
  const shake = useRef(0);
  const lastKey = useRef(shakeKey);
  const goal = useMemo(() => new THREE.Vector3(...position), [position]);
  const look = useMemo(() => new THREE.Vector3(...target), [target]);
  const current = useRef<THREE.Vector3 | null>(null);
  useFrame(({ camera, clock }, delta) => {
    if (lastKey.current !== shakeKey) {
      lastKey.current = shakeKey;
      shake.current = 1;
    }
    if (!current.current) current.current = goal.clone();
    current.current.lerp(goal, 1 - Math.pow(0.02, delta));
    const t = clock.elapsedTime;
    const s = shake.current * shakeStrength;
    camera.position.set(
      current.current.x + Math.sin(t * 0.3) * sway + (Math.random() - 0.5) * s,
      current.current.y + Math.sin(t * 0.21) * sway * 0.5 + (Math.random() - 0.5) * s,
      current.current.z,
    );
    camera.lookAt(look);
    shake.current = Math.max(0, shake.current - delta * 3.5);
  });
  return null;
}
