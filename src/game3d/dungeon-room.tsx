import { useMemo } from 'react';
import * as THREE from 'three';

import { MODELS } from './assets';
import { TorchLight } from './effects';
import { useDungeonPieces } from './models';

export interface PropPlacement {
  piece: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}

/** Layout for the standard room: three floor tiles deep, a back wall with the floor gate. */
export function roomLayout(options: { gate: 'sealed' | 'open' | 'boss'; variant: number }): PropPlacement[] {
  const pieces: PropPlacement[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      const cracked = (x + z + options.variant) % 4 === 0;
      pieces.push({ piece: cracked ? 'floor_dirt_large' : 'floor_tile_large', position: [x * 4, 0, z * 4] });
    }
  }
  // Back wall with the gate in the middle, two storeys tall.
  pieces.push({ piece: 'wall_pillar', position: [-4, 0, -6] });
  pieces.push({ piece: options.gate === 'sealed' ? 'wall_gated' : 'wall_doorway', position: [0, 0, -6] });
  pieces.push({ piece: 'wall_pillar', position: [4, 0, -6] });
  pieces.push({ piece: 'wall', position: [-4, 4, -6] });
  pieces.push({ piece: 'wall_arched', position: [0, 4, -6] });
  pieces.push({ piece: 'wall', position: [4, 4, -6] });
  pieces.push({ piece: 'wall', position: [-6, 4, -4], rotationY: Math.PI / 2 });
  pieces.push({ piece: 'wall', position: [6, 4, -4], rotationY: -Math.PI / 2 });
  // Side walls angle the room so it reads as a chamber.
  pieces.push({ piece: 'wall', position: [-6, 0, -4], rotationY: Math.PI / 2 });
  pieces.push({ piece: 'wall', position: [6, 0, -4], rotationY: -Math.PI / 2 });
  pieces.push({ piece: 'wall_arched', position: [-6, 0, 0], rotationY: Math.PI / 2 });
  pieces.push({ piece: 'wall_cracked', position: [6, 0, 0], rotationY: -Math.PI / 2 });
  // Torches on the back wall.
  pieces.push({ piece: 'torch_mounted', position: [-2.3, 2.3, -5.5] });
  pieces.push({ piece: 'torch_mounted', position: [2.3, 2.3, -5.5] });
  // Dressing.
  pieces.push({ piece: 'banner_patternA_red', position: [-4, 0, -5.9] });
  pieces.push({ piece: 'banner_patternA_red', position: [4, 0, -5.9] });
  pieces.push({ piece: 'barrel_large', position: [-4.6, 0, -3.8], rotationY: 0.4 });
  pieces.push({ piece: 'barrel_small', position: [-3.5, 0, -4.6] });
  pieces.push({ piece: 'crates_stacked', position: [4.4, 0, -3.9], rotationY: -0.3 });
  pieces.push({ piece: 'candle_triple', position: [3.2, 0, -4.8] });
  pieces.push({ piece: options.variant % 2 ? 'rubble_half' : 'column', position: [-5.4, 0, 2.5], rotationY: 1.2, scale: 0.6 });
  return pieces;
}

export function DungeonRoom({
  layout,
  torchColor,
}: {
  layout: PropPlacement[];
  torchColor: string;
}) {
  const pieces = useDungeonPieces(MODELS.dungeon);
  const objects = useMemo(
    () =>
      layout.map((p, i) => {
        const source = pieces.get(p.piece);
        if (!source) return null;
        const obj = source.clone(true);
        obj.position.set(...p.position);
        obj.rotation.y = p.rotationY ?? 0;
        obj.scale.setScalar(p.scale ?? 1);
        return <primitive key={`${p.piece}-${i}`} object={obj} />;
      }),
    [layout, pieces],
  );
  const torches = layout.filter((p) => p.piece === 'torch_mounted');
  return (
    <group>
      {objects}
      {torches.map((t, i) => (
        <TorchLight
          key={i}
          seed={i + 1}
          color={torchColor}
          position={[t.position[0], t.position[1] + 0.85, t.position[2] + 0.42]}
        />
      ))}
    </group>
  );
}

export function SceneAtmosphere({ fog, near = 9, far = 24 }: { fog: string; near?: number; far?: number }) {
  const color = useMemo(() => new THREE.Color(fog), [fog]);
  return (
    <>
      <color attach="background" args={[color]} />
      <fog attach="fog" args={[color, near, far]} />
      <hemisphereLight args={['#7d8db0', '#1e130b', 0.6]} />
      {/* Warm key light over the arena, cool rim light from behind the gate. */}
      <pointLight position={[0, 6.5, 5]} intensity={46} distance={22} decay={1.4} color="#ffd29a" />
      <pointLight position={[0, 3, -8]} intensity={20} distance={14} decay={1.5} color="#7aa6ff" />
    </>
  );
}
