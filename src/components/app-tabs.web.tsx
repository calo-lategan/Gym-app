import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

const TABS: { name: string; href: '/' | '/dungeon' | '/plan' | '/hero'; label: string; icon: IconName }[] = [
  { name: '(camp)', href: '/', label: 'Camp', icon: 'camp' },
  { name: 'dungeon', href: '/dungeon', label: 'Dungeon', icon: 'dungeon' },
  { name: 'plan', href: '/plan', label: 'Plan', icon: 'plan' },
  { name: 'hero', href: '/hero', label: 'Hero', icon: 'hero' },
];

/** Web tab bar styled like the Android bottom navigation. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={{
          flexDirection: 'row',
          backgroundColor: colors.stone,
          borderTopWidth: 1,
          borderTopColor: colors.seam,
          paddingBottom: spacing.xs,
        }}
      >
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton icon={tab.icon} label={tab.label} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const TabButton = forwardRef<View, TabTriggerSlotProps & { icon: IconName; label: string }>(function TabButton(
  { icon, label, isFocused, ...props },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: 2 }}
    >
      <View
        style={{
          paddingHorizontal: spacing.ml,
          paddingVertical: spacing.xs,
          borderRadius: 999,
          backgroundColor: isFocused ? 'rgba(242, 169, 59, 0.18)' : 'transparent',
        }}
      >
        <Icon name={icon} size={22} color={isFocused ? colors.torch : colors.dim} />
      </View>
      <Text variant="label" color={isFocused ? colors.bone : colors.dim}>
        {label}
      </Text>
    </Pressable>
  );
});
