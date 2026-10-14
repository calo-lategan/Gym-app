import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { formatClock } from '@/domain/schedule';
import type { ClockTime } from '@/domain/types';
import { haptics } from '@/services/haptics';
import { colors, radius, spacing } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export interface TimePickerProps {
  value: ClockTime;
  onChange: (time: ClockTime) => void;
  use24h?: boolean;
  label?: string;
  testID?: string;
}

/** Shows the time; tapping opens the platform time picker (Material dialog on Android). */
export function TimePicker({ value, onChange, use24h = false, label = 'Gym time', testID }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const date = new Date();
  date.setHours(value.hour, value.minute, 0, 0);
  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatClock(value, use24h)}. Tap to change.`}
        onPress={() => {
          haptics.tap();
          setOpen(true);
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          minHeight: 56,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.seam,
          backgroundColor: pressed ? colors.slateHigh : colors.slate,
        })}
      >
        <Icon name="clock" size={20} color={colors.torch} />
        <Text variant="stat" style={{ flex: 1 }}>
          {formatClock(value, use24h)}
        </Text>
        <Text variant="caption">Change</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour={use24h}
          accentColor={colors.torch}
          themeVariant="dark"
          presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
          onValueChange={(_, picked) => {
            setOpen(Platform.OS !== 'android' ? open : false);
            onChange({ hour: picked.getHours(), minute: picked.getMinutes() });
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}
