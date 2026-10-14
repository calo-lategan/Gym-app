import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { MonsterKind } from '@/domain/game/dungeon';
import { zoneForFloor } from '@/domain/game/dungeon';
import type { Hero } from '@/domain/types';

import { HeroModel, MonsterModel } from '../actors';
import { GameCanvas } from '../canvas';
import { DungeonRoom, roomLayout, SceneAtmosphere } from '../dungeon-room';
import { CameraRig, Embers, getGlowTexture } from '../effects';
import { heroLoadout } from '../loadout';

const CAM: [number, number, number] = [0.2, 3.1, 6.6];
const TARGET: [number, number, number] = [0.1, 1.15, 0];
const HIT_DELAY_MS = 260;

/** Flash of light where a blow lands. */
function HitSpark({ sparkKey, color, position }: { sparkKey: number; color: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Sprite>(null);
  const started = useRef<number | null>(null);
  const last = useRef(sparkKey);
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: new THREE.Color(color).multiplyScalar(2),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      }),
    [color],
  );
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (last.current !== sparkKey) {
      last.current = sparkKey;
      started.current = clock.elapsedTime;
    }
    const age = started.current === null ? 9 : clock.elapsedTime - started.current;
    const s = 0.6 + age * 7;
    ref.current.scale.set(s, s, 1);
    material.opacity = Math.max(0, 1 - age * 4);
  });
  return <sprite ref={ref} position={position} material={material} />;
}

export interface BattleSceneProps {
  hero: Hero;
  floor: number;
  monster: { kind: MonsterKind; boss: boolean; id: string };
  /** Increments with every logged set. */
  strikeKey: number;
  crit: boolean;
  /** The current monster has no health left. */
  monsterDead: boolean;
  cheerKey: number;
}

/**
 * Hero versus monster. Every logged set is a strike, a record lands as a
 * critical hit, and finishing an exercise brings the monster down. A new foe
 * rises from the floor for the next exercise.
 */
export function BattleScene({ hero, floor, monster, strikeKey, crit, monsterDead, cheerKey }: BattleSceneProps) {
  const zone = zoneForFloor(floor);
  const loadout = useMemo(() => heroLoadout(hero), [hero]);
  const layout = useMemo(() => roomLayout({ gate: 'open', variant: floor + 1 }), [floor]);
  const [heroShot, setHeroShot] = useState<{ name: string; key: number; speed?: number } | null>(null);
  const [monsterShot, setMonsterShot] = useState<{ name: string; key: number } | null>({ name: 'Spawn_Ground_Skeletons', key: 1 });
  const [shake, setShake] = useState(0);
  const [spark, setSpark] = useState(0);
  const [dying, setDying] = useState(false);

  // A new monster rises from the floor.
  useEffect(() => {
    setDying(false);
    setMonsterShot((s) => ({ name: 'Spawn_Ground_Skeletons', key: (s?.key ?? 0) + 1 }));
  }, [monster.id]);

  // Hero swings, then the blow lands a beat later.
  useEffect(() => {
    if (strikeKey === 0) return;
    const attacks = crit || monsterDead ? [loadout.finisher] : loadout.attacks;
    setHeroShot((s) => ({ name: attacks[strikeKey % attacks.length], key: (s?.key ?? 0) + 1, speed: 1.25 }));
    const t = setTimeout(() => {
      setShake((k) => k + 1);
      setSpark((k) => k + 1);
      if (monsterDead) setDying(true);
      else setMonsterShot((s) => ({ name: strikeKey % 2 ? 'Hit_A' : 'Hit_B', key: (s?.key ?? 0) + 1 }));
    }, HIT_DELAY_MS);
    return () => clearTimeout(t);
    // Only react to new strikes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strikeKey]);

  useEffect(() => {
    if (cheerKey === 0) return;
    const t = setTimeout(() => setHeroShot((s) => ({ name: 'Cheer', key: (s?.key ?? 0) + 1 })), 900);
    return () => clearTimeout(t);
  }, [cheerKey]);

  const monsterScale = monster.boss ? 1.5 : 1;
  return (
    <GameCanvas camera={{ position: CAM, fov: 46 }}>
      <CameraRig position={CAM} target={TARGET} shakeKey={shake} shakeStrength={crit || monsterDead ? 0.35 : 0.18} sway={0.08} />
      <SceneAtmosphere fog={zone.fog} near={7} far={20} />
      <Suspense fallback={null}>
        <DungeonRoom layout={layout} torchColor={zone.light} />
        <HeroModel hero={hero} oneShot={heroShot} position={[-1.3, 0, 0.3]} rotation={[0, Math.PI / 2 - 0.45, 0]} />
        <MonsterModel
          key={monster.id}
          kind={monster.kind}
          boss={monster.boss}
          scale={monsterScale}
          action={dying ? 'Death_C_Skeletons' : 'Idle_Combat'}
          oneShot={dying ? null : monsterShot}
          position={[1.4, 0, -0.1]}
          rotation={[0, -Math.PI / 2 + 0.45, 0]}
          holdAction={dying}
        />
        <HitSpark sparkKey={spark} color={crit ? '#ffd36b' : '#ffffff'} position={[0.5, 1.3, 0.1]} />
        <Embers count={24} spread={8} height={5} color={zone.light} size={0.06} speed={0.3} seed={5} />
      </Suspense>
    </GameCanvas>
  );
}
