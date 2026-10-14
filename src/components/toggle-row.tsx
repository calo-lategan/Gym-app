import { Switch, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/** Label plus the platform switch, tinted to the torch accent. */
export function ToggleRow({
  label,
  detail,
  value,
  onValueChange,
  icon,
  testID,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: IconName;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ms, minHeight: 52 }}>
      {icon ? <Icon name={icon} size={20} color={colors.ash} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {detail ? <Text variant="caption">{detail}</Text> : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.slateHigh, true: colors.torchDeep }}
        thumbColor={value ? colors.torch : colors.ash}
        ios_backgroundColor={colors.slateHigh}
      />
    </View>
  );
}
