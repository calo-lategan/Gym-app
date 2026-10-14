import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

import { Text } from './text';

/**
 * Scrolling page for the tab roots: a display-face title in place of a
 * navigation bar, so every tab reads like a page of the game.
 */
export function TabScreen({
  title,
  subtitle,
  right,
  children,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: colors.abyss }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.md, gap: spacing.lg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text variant="subhead">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </ScrollView>
  );
}

/** Scrolling body for pushed screens and sheets that already have a header or grabber. */
export function PageScroll({ children, testID, padTop = spacing.md }: { children: ReactNode; testID?: string; padTop?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: padTop, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.md, gap: spacing.lg }}
    >
      {children}
    </ScrollView>
  );
}

export function Section({ title, action, children, detail }: { title: string; action?: ReactNode; children: ReactNode; detail?: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: 32 }}>
        <Text variant="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {detail ? <Text variant="caption">{detail}</Text> : null}
      {children}
    </View>
  );
}

/** Hairline between rows inside a panel. */
export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.seam }} />;
}
