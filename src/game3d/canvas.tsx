import { Canvas } from '@react-three/fiber/native';
import { useEffect, type ReactNode } from 'react';
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';

import { markSceneSettled, markSceneStarting, SCENE_SETTLE_MS } from '@/state/scene-watch';

import './polyfills';
import { guardRender, SceneGuard } from './scene-guard';

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
export function GameCanvas(props: GameCanvasProps) {
  return (
    <SceneGuard style={props.style}>
      <NativeCanvas {...props} />
    </SceneGuard>
  );
}

function NativeCanvas({ children, style, camera, frameloop = 'always', onCreated }: GameCanvasProps) {
  // Leaves a marker while the scene starts, so a native crash turns 3D off on the next launch.
  useEffect(() => {
    markSceneStarting();
    const settle = setTimeout(markSceneSettled, SCENE_SETTLE_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') markSceneSettled();
    });
    return () => {
      clearTimeout(settle);
      sub.remove();
      markSceneSettled();
    };
  }, []);

  return (
    <View style={[styles.fill, style]} pointerEvents="box-none">
      <Canvas
        style={styles.fill}
        frameloop={frameloop}
        camera={{ position: camera?.position ?? [0, 2.4, 6], fov: camera?.fov ?? 42, near: 0.1, far: 80 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          guardRender(gl);
          onCreated?.();
        }}
      >
        {children}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
