import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';

import { colors } from '@/theme';

type ScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;

/** Native bottom sheet with a grab handle and swipe to dismiss. */
export const sheetOptions = (detents: number[] = [0.6, 0.95]): ScreenOptions => ({
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  sheetAllowedDetents: detents,
  sheetCornerRadius: 24,
  contentStyle: { backgroundColor: colors.stone },
  headerShown: false,
});
