import { Text as RNText, type TextProps } from 'react-native';

import { type, type TypeVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Every piece of text goes through the type ramp; screens never set raw font sizes. */
export function Text({ variant = 'body', color, align, style, ...props }: AppTextProps) {
  return <RNText {...props} style={[type[variant], color ? { color } : null, align ? { textAlign: align } : null, style]} />;
}
