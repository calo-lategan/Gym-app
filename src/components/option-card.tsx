import { Pressable, View } from 'react-native';

import { haptics } from '@/services/haptics';
import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Large single-choice option with a title and one line of explanation. */
export function OptionCard({
  title,
  detail,
  icon,
  selected,
  onPress,
  testID,
}: {
  title: string;
  detail: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.torch : colors.seam,
        backgroundColor: selected ? 'rgba(242, 169, 59, 0.1)' : pressed ? colors.slate : colors.stone,
      })}
    >
      {icon ? (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? 'rgba(242, 169, 59, 0.2)' : colors.slate,
          }}
        >
          <Icon name={icon} size={24} color={selected ? colors.torch : colors.ash} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        <Text variant="caption">{detail}</Text>
      </View>
      <Icon name={selected ? 'check' : 'chevronRight'} size={20} color={selected ? colors.torch : colors.dim} />
    </Pressable>
  );
}
