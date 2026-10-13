import { Suspense, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MODELS } from '@/game3d/assets';
import { GameCanvas } from '@/game3d/canvas';
import { DungeonRoom, roomLayout, SceneAtmosphere } from '@/game3d/dungeon-room';
import { BlobShadow, CameraRig, Embers } from '@/game3d/effects';
import { Character } from '@/game3d/models';

const CAM_POS: [number, number, number] = [0, 7.2, 11.5];
const CAM_TARGET: [number, number, number] = [0, 1.1, -0.8];

export default function Spike() {
  const [attack, setAttack] = useState(0);
  return (
    <View style={{ flex: 1, backgroundColor: '#0d1416' }}>
      <GameCanvas camera={{ position: CAM_POS, fov: 50 }}>
        <CameraRig position={CAM_POS} target={CAM_TARGET} shakeKey={attack} />
        <SceneAtmosphere fog="#0d1416" />
        <Suspense fallback={null}>
          <DungeonRoom layout={roomLayout({ gate: 'sealed', variant: 1 })} torchColor="#ffb45e" />
          <group position={[-0.9, 0, 0.6]} rotation={[0, 0.5, 0]}>
            <BlobShadow />
            <Character
              model={MODELS.heroes.knight}
              animations={[MODELS.heroAnims]}
              action="Idle"
              oneShot={attack ? { name: '1H_Melee_Attack_Chop', key: attack } : null}
              visible={(name) => !['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword'].includes(name)}
            />
          </group>
          <group position={[1.4, 0, -0.6]} rotation={[0, -0.7, 0]}>
            <BlobShadow />
            <Character model={MODELS.monsters.skeleton_minion} animations={[MODELS.skeletonAnims]} action="Idle_Combat" />
          </group>
          <Embers count={40} spread={10} height={5} color="#ffb45e" size={0.07} speed={0.3} />
        </Suspense>
      </GameCanvas>
      <Pressable
        testID="attack"
        onPress={() => setAttack((a) => a + 1)}
        style={{ position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#F2A93B', padding: 16, borderRadius: 14 }}
      >
        <Text style={{ fontWeight: '700' }}>Attack</Text>
      </Pressable>
    </View>
  );
}
