import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Text } from './text';

/** Labelled text input: label above, helper or error below. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  helper,
  error,
  testID,
  autoFocus,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  helper?: string;
  error?: string | null;
  testID?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 54,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: error ? colors.ember : colors.seam,
          backgroundColor: colors.slate,
          paddingHorizontal: spacing.md,
        }}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.dim}
          keyboardType={keyboardType}
          autoFocus={autoFocus}
          maxLength={maxLength}
          selectionColor={colors.torch}
          style={{ flex: 1, color: colors.bone, fontSize: 18, fontWeight: '600', paddingVertical: spacing.ms }}
        />
        {suffix ? <Text variant="subhead">{suffix}</Text> : null}
      </View>
      {error ? (
        <Text variant="caption" color={colors.ember}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption">{helper}</Text>
      ) : null}
    </View>
  );
}

/** Parse a user-typed number, accepting a comma decimal separator. */
export function parseNumber(text: string): number | null {
  const value = Number(text.replace(',', '.').trim());
  return Number.isFinite(value) && text.trim() !== '' ? value : null;
}
