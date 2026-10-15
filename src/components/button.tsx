import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/services/haptics';
import { play, type SoundName } from '@/services/sound';
import { colors, radius, spacing, touch } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

const variants = {
  primary: { bg: colors.torch, bgPressed: colors.torchDeep, fg: colors.onTorch, border: colors.torchHigh },
  secondary: { bg: colors.slate, bgPressed: colors.slateHigh, fg: colors.bone, border: colors.seam },
  ghost: { bg: 'transparent', bgPressed: colors.slate, fg: colors.bone, border: 'transparent' },
  danger: { bg: colors.emberDeep, bgPressed: colors.ember, fg: colors.bone, border: colors.ember },
} as const;

const sizes = {
  sm: { minHeight: 40, paddingHorizontal: spacing.ms, gap: spacing.xs, text: 'label' as const, icon: 16 },
  md: { minHeight: touch.min, paddingHorizontal: spacing.md, gap: spacing.sm, text: 'headline' as const, icon: 20 },
  lg: { minHeight: 58, paddingHorizontal: spacing.lg, gap: spacing.sm, text: 'headline' as const, icon: 22 },
  xl: { minHeight: 76, paddingHorizontal: spacing.lg, gap: spacing.ms, text: 'title' as const, icon: 28 },
};

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Sound played on press. Defaults to a soft tap; pass null for silence. */
  sound?: SoundName | null;
  testID?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  sound = 'tap',
  testID,
  accessibilityHint,
  style,
}: ButtonProps) {
  const v = variants[variant];
  const s = sizes[size];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!inactive}
      aria-busy={!!loading}
      disabled={inactive}
      hitSlop={6}
      onPressIn={() => {
        if (!inactive) haptics.tap();
      }}
      onPress={() => {
        if (sound) play(sound, 0.7);
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: s.minHeight,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: pressed ? v.bgPressed : v.bg,
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: v.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: inactive ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          boxShadow: variant === 'primary' && !inactive ? '0 0 20px rgba(242, 169, 59, 0.28)' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.gap }}>
          {icon ? <Icon name={icon} size={s.icon} color={v.fg} /> : null}
          <Text variant={s.text} color={v.fg} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Round icon-only button with an accessible label. */
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.bone,
  size = 22,
  testID,
  tone = 'plain',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  testID?: string;
  tone?: 'plain' | 'filled';
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPressIn={() => haptics.tap()}
      onPress={() => {
        play('tap', 0.6);
        onPress();
      }}
      style={({ pressed }) => ({
        width: touch.min,
        height: touch.min,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'filled' ? (pressed ? colors.slateHigh : colors.glass) : pressed ? colors.slate : 'transparent',
        borderWidth: tone === 'filled' ? 1 : 0,
        borderColor: colors.seam,
      })}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}
