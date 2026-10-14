import { Stack } from 'expo-router';

import { HeroScreen } from '@/screens/hero';

export default function HeroRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HeroScreen />
    </>
  );
}
