import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/services/haptics';
import { colors, radius, spacing } from '@/theme';

/**
 * A stone panel for grouping related content. Use sparingly: rows inside a
 * panel are separated by spacing or hairlines, never by nested panels.
 */
export function Panel({
  children,
  style,
  tone = 'stone',
  onPress,
  testID,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'stone' | 'glass' | 'torch' | 'ember';
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const border = tone === 'torch' ? 'rgba(242, 169, 59, 0.55)' : tone === 'ember' ? 'rgba(232, 85, 62, 0.55)' : colors.seam;
  const bg =
    tone === 'glass' ? colors.glass : tone === 'torch' ? 'rgba(242, 169, 59, 0.08)' : tone === 'ember' ? 'rgba(232, 85, 62, 0.08)' : colors.stone;
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: border,
    padding: spacing.md,
    gap: spacing.ms,
  };
  if (!onPress) {
    return (
      <View testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => haptics.tap()}
      onPress={onPress}
      style={({ pressed }) => [base, { backgroundColor: pressed ? colors.slate : bg }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.seam }, style]} />;
}
