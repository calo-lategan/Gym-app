import { Canvas } from '@react-three/fiber/native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';

import './polyfills';

export interface GameCanvasProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Camera position and field of view. */
  camera?: { position: [number, number, number]; fov?: number };
  /** `demand` renders only when something changes; use for idle screens. */
  frameloop?: 'always' | 'demand' | 'never';
  onCreated?: () => void;
}

/** Native 3D canvas backed by expo-gl. See canvas.web.tsx for the browser version. */
export function GameCanvas({ children, style, camera, frameloop = 'always', onCreated }: GameCanvasProps) {
  return (
    <View style={[styles.fill, style]} pointerEvents="box-none">
      <Canvas
        style={styles.fill}
        frameloop={frameloop}
        dpr={[1, 2]}
        camera={{ position: camera?.position ?? [0, 2.4, 6], fov: camera?.fov ?? 42, near: 0.1, far: 80 }}
        gl={{ antialias: true }}
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
