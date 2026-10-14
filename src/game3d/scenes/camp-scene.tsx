import { Suspense, useCallback, useMemo, useState } from 'react';

import { BALANCE } from '@/domain/game/balance';
import { isBossFloor, zoneForFloor } from '@/domain/game/dungeon';
import type { DungeonState, Hero } from '@/domain/types';
import { play } from '@/services/sound';
import { haptics } from '@/services/haptics';

import { HeroModel, MonsterModel } from '../actors';
import { GameCanvas } from '../canvas';
import { DungeonRoom, roomLayout, SceneAtmosphere } from '../dungeon-room';
import { CameraRig, Embers } from '../effects';
import { Campfire } from '../props';

const CAM: [number, number, number] = [0, 6.4, 11];
// Aimed low so the hero sits in the band between the HUD and the quest panel.
const TARGET: [number, number, number] = [0, -0.9, -1.4];

export type CampMood = 'ready' | 'resting' | 'victorious';

/**
 * The hub scene: the hero in the current dungeon room. Training days show the
 * hero battle-ready with the floor gate behind; rest days put them by a fire.
 * Tap the hero for a flourish.
 */
export function CampScene({ hero, dungeon, mood }: { hero: Hero; dungeon: DungeonState; mood: CampMood }) {
  const zone = zoneForFloor(dungeon.floor);
  const [shot, setShot] = useState<{ name: string; key: number } | null>(null);
  const [shake, setShake] = useState(0);
  const rooms = BALANCE.dungeon.roomsPerFloor;
  const gateSealed = dungeon.roomsCleared >= rooms && dungeon.sigils === 0 && !isBossFloor(dungeon.floor);
  const layout = useMemo(() => roomLayout({ gate: gateSealed ? 'sealed' : 'open', variant: dungeon.floor }), [gateSealed, dungeon.floor]);
  const resting = mood === 'resting';

  const onHeroTap = useCallback(() => {
    if (resting) return;
    const flourishes = mood === 'victorious' ? ['Cheer', 'Jump_Full_Short'] : ['1H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', 'Block'];
    const name = flourishes[Math.floor(Math.random() * flourishes.length)];
    setShot((s) => ({ name, key: (s?.key ?? 0) + 1 }));
    if (name.includes('Attack')) {
      play('slash', 0.6);
      haptics.light();
      setShake((k) => k + 1);
    } else {
      play('streak', 0.4);
    }
  }, [mood, resting]);

  return (
    <GameCanvas camera={{ position: CAM, fov: 48 }}>
      <CameraRig position={CAM} target={TARGET} shakeKey={shake} shakeStrength={0.12} />
      <SceneAtmosphere fog={zone.fog} near={10} far={26} />
      <Suspense fallback={null}>
        <DungeonRoom layout={layout} torchColor={zone.light} />
        <HeroModel
          hero={hero}
          resting={resting}
          action={resting ? 'Sit_Floor_Idle' : mood === 'victorious' ? 'Idle' : undefined}
          oneShot={shot}
          position={resting ? [-0.9, 0, 0.6] : [0, 0, 0.6]}
          rotation={[0, resting ? 0.7 : 0.15, 0]}
          onPointerDown={onHeroTap}
        />
        {resting ? <Campfire position={[0.9, 0, 1.2]} /> : null}
        {!resting && isBossFloor(dungeon.floor) && dungeon.boss ? (
          <MonsterModel kind="skeleton_warrior" boss scale={1.55} position={[0, 0, -3.2]} action="Idle_Combat" />
        ) : null}
        {!resting && !(isBossFloor(dungeon.floor) && dungeon.boss) ? (
          <MonsterModel
            kind={zone.monsters[0]}
            action="Skeletons_Inactive_Floor_Pose"
            position={[2.8, 0, -2.6]}
            rotation={[0, -0.9, 0]}
          />
        ) : null}
        <Embers count={36} spread={11} height={6} color={zone.light} size={0.07} speed={0.25} seed={2} />
      </Suspense>
    </GameCanvas>
  );
}
