import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { haptics } from '@/services/haptics';
import { colors, radius, spacing, touch } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/**
 * Big plus and minus steppers for logging at the gym: thumb-sized, readable
 * from arm's length, and they repeat while held for large jumps.
 */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format = (v) => String(v),
  testID,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  testID?: string;
  /** Smaller buttons for tight rows. */
  compact?: boolean;
}) {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const nudge = (direction: 1 | -1) => {
    const next = Math.min(max, Math.max(min, Math.round((latest.current + direction * step) * 1000) / 1000));
    if (next !== latest.current) {
      latest.current = next;
      haptics.tap();
      onChange(next);
    }
  };
  const stopRepeat = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const startRepeat = (direction: 1 | -1) => {
    stopRepeat();
    timer.current = setInterval(() => nudge(direction), 110);
  };

  const button = (direction: 1 | -1) => (
    <Pressable
      testID={testID ? `${testID}-${direction > 0 ? 'plus' : 'minus'}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${direction > 0 ? 'Increase' : 'Decrease'} ${label}`}
      onPress={() => nudge(direction)}
      onLongPress={() => startRepeat(direction)}
      onPressOut={stopRepeat}
      delayLongPress={350}
      style={({ pressed }) => ({
        width: compact ? touch.min : touch.big,
        height: compact ? touch.min : touch.big,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.slateHigh : colors.slate,
        borderWidth: 1,
        borderColor: colors.seam,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Icon name={direction > 0 ? 'plus' : 'minus'} size={28} />
    </Pressable>
  );

  const text = format(value);
  // adjustsFontSizeToFit is native only, so long values also step down in size.
  const fontSize = compact ? (text.length > 4 ? 20 : text.length > 3 ? 23 : 28) : text.length > 6 ? 24 : 28;

  return (
    <View style={{ gap: spacing.xs, flex: 1 }}>
      <Text variant="label" align="center">
        {label}
      </Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: format(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? spacing.xs : spacing.sm }}
      >
        {button(-1)}
        <Text testID={testID ? `${testID}-value` : undefined} variant="stat" align="center" style={{ flex: 1, fontSize, lineHeight: 34 }} numberOfLines={1} adjustsFontSizeToFit>
          {text}
        </Text>
        {button(1)}
      </View>
    </View>
  );
}
