import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { modelUrl } from './assets';

export function useModel(module: number): GLTF {
  return useLoader(GLTFLoader, modelUrl(module));
}

/**
 * Palette textures are tiny gradient atlases: sample them without mipmaps so
 * neighbouring swatches never bleed into each other.
 */
export function prepareMaterials(root: THREE.Object3D, options: { emissive?: THREE.ColorRepresentation; emissiveIntensity?: number } = {}) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = materials.map((m) => {
      const source = m as THREE.MeshStandardMaterial;
      if (source.map) {
        source.map.minFilter = THREE.LinearFilter;
        source.map.generateMipmaps = false;
        source.map.needsUpdate = true;
      }
      const lambert = new THREE.MeshLambertMaterial({
        map: source.map ?? null,
        color: source.color ?? new THREE.Color('#ffffff'),
        transparent: source.transparent,
        opacity: source.opacity,
        emissive: options.emissive ? new THREE.Color(options.emissive) : (source.emissive ?? new THREE.Color('#000000')),
        emissiveIntensity: options.emissiveIntensity ?? 1,
      });
      lambert.name = source.name;
      // KayKit marks glowing parts (eyes, runes) with a material named "Glow".
      if (/glow/i.test(source.name)) {
        lambert.emissive = new THREE.Color(source.color ?? '#9ef');
        lambert.emissiveIntensity = 2.2;
      }
      return lambert;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

export interface OneShot {
  name: string;
  /** Change the key to replay the same clip. */
  key: number;
  /** Playback speed multiplier. */
  speed?: number;
}

export interface MeshGlow {
  meshes: string[];
  color: THREE.ColorRepresentation;
  intensity: number;
}

export interface CharacterProps {
  model: number;
  /** Extra emissive glow on specific meshes, such as a rare weapon. */
  glow?: MeshGlow | null;
  animations: number[];
  /** Looping base animation. */
  action: string;
  oneShot?: OneShot | null;
  /** Meshes to show; all other weapon or prop meshes are hidden. Undefined shows everything. */
  visible?: (meshName: string) => boolean;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  /** Speed of the base loop. */
  timeScale?: number;
  /** Play the base action once and hold the last frame (for deaths). */
  holdAction?: boolean;
  onOneShotEnd?: (name: string) => void;
  onPointerDown?: () => void;
}

export function Character({
  model,
  animations,
  action,
  oneShot,
  visible,
  glow,
  emissive,
  emissiveIntensity,
  position,
  rotation,
  scale = 1,
  timeScale = 1,
  holdAction = false,
  onOneShotEnd,
  onPointerDown,
}: CharacterProps) {
  const gltf = useModel(model);
  const libraries = useLoader(GLTFLoader, animations.map(modelUrl));
  const clips = useMemo(() => libraries.flatMap((lib) => lib.animations), [libraries]);

  const root = useMemo(() => {
    const cloned = cloneSkinned(gltf.scene);
    prepareMaterials(cloned, { emissive, emissiveIntensity });
    return cloned;
    // Materials are set once per mount; emissive changes are rare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);

  useEffect(() => {
    if (!visible) return;
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && !(obj as THREE.SkinnedMesh).isSkinnedMesh) obj.visible = visible(obj.name);
    });
  }, [root, visible]);

  const glowKey = glow ? `${glow.meshes.join(',')}|${String(glow.color)}|${glow.intensity}` : '';
  useEffect(() => {
    if (!glow) return;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !glow.meshes.includes(mesh.name)) return;
      const material = (mesh.material as THREE.MeshLambertMaterial).clone();
      material.emissive = new THREE.Color(glow.color);
      material.emissiveIntensity = glow.intensity;
      mesh.material = material;
    });
    // glowKey captures the glow contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, glowKey]);

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  const base = useRef<THREE.AnimationAction | null>(null);
  const endCallback = useRef(onOneShotEnd);
  useEffect(() => {
    endCallback.current = onOneShotEnd;
  });

  const clipByName = (name: string) => clips.find((c) => c.name === name);

  useEffect(() => {
    const clip = clipByName(action);
    if (!clip) return;
    const next = mixer.clipAction(clip);
    next.reset().setLoop(holdAction ? THREE.LoopOnce : THREE.LoopRepeat, holdAction ? 1 : Infinity);
    next.clampWhenFinished = holdAction;
    next.fadeIn(0.15).play();
    next.timeScale = timeScale;
    if (base.current && base.current !== next) base.current.fadeOut(0.25);
    base.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, mixer, clips]);

  useEffect(() => {
    if (base.current) base.current.timeScale = timeScale;
  }, [timeScale]);

  useEffect(() => {
    if (!oneShot) return;
    const clip = clipByName(oneShot.name);
    if (!clip) return;
    const shot = mixer.clipAction(clip);
    shot.reset().setLoop(THREE.LoopOnce, 1);
    shot.clampWhenFinished = true;
    shot.timeScale = oneShot.speed ?? 1;
    shot.fadeIn(0.08).play();
    base.current?.fadeOut(0.08);
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== shot) return;
      shot.fadeOut(0.2);
      base.current?.reset().fadeIn(0.2).play();
      endCallback.current?.(oneShot.name);
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oneShot?.key, mixer, clips]);

  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  useFrame((_, delta) => mixer.update(Math.min(delta, 0.05)));

  return (
    <primitive
      object={root}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={onPointerDown ? () => onPointerDown() : undefined}
    />
  );
}

/** A static prop cloned from the merged dungeon model by node name. */
export function useDungeonPieces(module: number) {
  const gltf = useModel(module);
  return useMemo(() => {
    const pieces = new Map<string, THREE.Object3D>();
    for (const child of gltf.scene.children) {
      prepareMaterials(child);
      pieces.set(child.name, child);
    }
    return pieces;
  }, [gltf]);
}
