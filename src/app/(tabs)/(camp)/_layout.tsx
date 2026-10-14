import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function CampStack() {
  // Camp is a full-bleed 3D scene with its own HUD, like a game screen.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.abyss } }} />;
}
