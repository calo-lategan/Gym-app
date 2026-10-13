import { Canvas } from '@react-three/fiber';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';

import type { GameCanvasProps } from './canvas';

/** Browser 3D canvas (WebGL). Same props as the native version. */
export function GameCanvas({ children, style, camera, frameloop = 'always', onCreated }: GameCanvasProps) {
  return (
    <View style={[styles.fill, style]} pointerEvents="box-none">
      <Canvas
        style={{ flex: 1 }}
        frameloop={frameloop}
        dpr={[1, 2]}
        camera={{ position: camera?.position ?? [0, 2.4, 6], fov: camera?.fov ?? 42, near: 0.1, far: 80 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          onCreated?.();
        }}
      >
        {children}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
