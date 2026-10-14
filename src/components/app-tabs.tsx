import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme';

/** Platform tab bar: Material 3 bottom navigation on Android, the system tab bar on iOS. */
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={colors.stone}
      tintColor={colors.torch}
      iconColor={{ default: colors.dim, selected: colors.torch }}
      indicatorColor="rgba(242, 169, 59, 0.18)"
      rippleColor="rgba(242, 169, 59, 0.2)"
      labelStyle={{ default: { color: colors.dim }, selected: { color: colors.bone } }}
      labelVisibilityMode="labeled"
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="(camp)">
        <NativeTabs.Trigger.Icon sf="flame.fill" md="local_fire_department" />
        <NativeTabs.Trigger.Label>Camp</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="dungeon">
        <NativeTabs.Trigger.Icon sf="building.columns.fill" md="castle" />
        <NativeTabs.Trigger.Label>Dungeon</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="hero">
        <NativeTabs.Trigger.Icon sf="shield.lefthalf.filled" md="shield_person" />
        <NativeTabs.Trigger.Label>Hero</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
