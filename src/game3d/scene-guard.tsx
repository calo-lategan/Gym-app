import { Component, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { WebGLRenderer } from 'three';
import { create } from 'zustand';

import { Text } from '@/components/text';
import { useGame } from '@/state/stores';
import { colors, spacing } from '@/theme';

/**
 * The first 3D failure this session. Once set, every scene shows its backdrop
 * instead of trying again, so a graphics problem costs the 3D, never the app.
 */
const useSceneHealth = create<{ failure: string | null }>(() => ({ failure: null }));

export function reportSceneFailure(error: unknown) {
  if (useSceneHealth.getState().failure) return;
  const message = error instanceof Error ? error.message : String(error);
  useSceneHealth.setState({ failure: message || 'Unknown error' });
}

/** Errors thrown while drawing a frame happen outside React, so catch them at the renderer. */
export function guardRender(gl: WebGLRenderer) {
  const render = gl.render.bind(gl);
  gl.render = (scene, camera) => {
    try {
      render(scene, camera);
    } catch (error) {
      reportSceneFailure(error);
    }
  };
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    reportSceneFailure(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The lit backdrop scenes fall back to in lite mode or after a failure. */
function SceneBackdrop({ style, failure }: { style?: StyleProp<ViewStyle>; failure: string | null }) {
  return (
    <View style={[styles.backdrop, style]} testID="scene-backdrop">
      {failure ? (
        <Text variant="caption" color={colors.dim} numberOfLines={4} selectable>
          3D view unavailable. {failure}
        </Text>
      ) : null}
    </View>
  );
}

/** Renders a 3D scene only when it is wanted and still healthy. */
export function SceneGuard({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const graphics = useGame((s) => s.settings.graphics);
  const failure = useSceneHealth((s) => s.failure);
  if (graphics === 'lite' || failure) return <SceneBackdrop style={style} failure={failure} />;
  return <SceneBoundary>{children}</SceneBoundary>;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.sm,
    backgroundColor: colors.stone,
    experimental_backgroundImage: `radial-gradient(circle at 50% 110%, ${colors.torch}40 0%, transparent 70%)`,
  },
});
