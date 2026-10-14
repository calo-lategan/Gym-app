import { View } from 'react-native';

import { spacing } from '@/theme';

import { Stepper } from './stepper';
import type { TimePickerProps } from './time-picker';

/** Browser fallback: hour and minute steppers. */
export function TimePicker({ value, onChange, use24h = false, testID }: TimePickerProps) {
  const hourLabel = (h: number) => (use24h ? String(h).padStart(2, '0') : `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`);
  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <Stepper
        label="Hour"
        value={value.hour}
        min={0}
        max={23}
        onChange={(hour) => onChange({ ...value, hour })}
        format={hourLabel}
        testID={testID ? `${testID}-hour` : undefined}
      />
      <Stepper
        label="Minute"
        value={value.minute}
        min={0}
        max={55}
        step={5}
        onChange={(minute) => onChange({ ...value, minute })}
        format={(m) => String(m).padStart(2, '0')}
        testID={testID ? `${testID}-minute` : undefined}
      />
    </View>
  );
}
