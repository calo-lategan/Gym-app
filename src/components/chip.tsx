import { Pressable, View } from 'react-native';

import { haptics } from '@/services/haptics';
import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Selectable pill for choices like weekdays, equipment or soreness levels. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = 'torch',
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  tone?: 'torch' | 'ember' | 'verdant';
  testID?: string;
}) {
  const accent = tone === 'ember' ? colors.ember : tone === 'verdant' ? colors.verdant : colors.torch;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      aria-checked={selected}
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: selected ? accent : colors.seam,
        backgroundColor: selected ? `${accent}26` : pressed ? colors.slateHigh : colors.slate,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.xs,
      })}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? accent : colors.ash} /> : null}
      <Text variant="label" color={selected ? colors.bone : colors.ash} style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>;
}
