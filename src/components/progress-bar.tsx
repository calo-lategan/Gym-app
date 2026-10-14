import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radius } from '@/theme';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const tones = {
  xp: { fill: colors.torch, glow: 'rgba(242, 169, 59, 0.55)' },
  hp: { fill: colors.ember, glow: 'rgba(232, 85, 62, 0.55)' },
  good: { fill: colors.verdant, glow: 'rgba(102, 212, 156, 0.5)' },
  frost: { fill: colors.frost, glow: 'rgba(93, 178, 246, 0.5)' },
  arcane: { fill: colors.arcane, glow: 'rgba(181, 138, 246, 0.5)' },
} as const;

/**
 * Animated fill bar. The fill is an absolutely positioned, childless view,
 * so animating its width never re-lays out siblings.
 */
export function ProgressBar({
  value,
  tone = 'xp',
  height = 10,
  style,
  accessibilityLabel,
  durationMs = 700,
}: {
  value: number;
  tone?: keyof typeof tones;
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  durationMs?: number;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const reduced = useReducedMotion();
  const progress = useSharedValue(clamped);
  useEffect(() => {
    progress.set(reduced ? clamped : withTiming(clamped, { duration: durationMs, easing: EASE_OUT }));
  }, [clamped, durationMs, progress, reduced]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const t = tones[tone];
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          height,
          borderRadius: radius.full,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          borderWidth: 1,
          borderColor: colors.seam,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            borderRadius: radius.full,
            backgroundColor: t.fill,
            boxShadow: `0 0 10px ${t.glow}`,
          },
          fill,
        ]}
      />
    </View>
  );
}
