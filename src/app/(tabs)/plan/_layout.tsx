import { Stack } from 'expo-router';

import { colors, fonts } from '@/theme';

export default function PlanStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.abyss },
        headerTintColor: colors.bone,
        headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 24 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.abyss },
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );
}
