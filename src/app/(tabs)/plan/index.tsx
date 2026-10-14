import { Stack } from 'expo-router';

import { PlanScreen } from '@/screens/plan';

export default function PlanRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PlanScreen />
    </>
  );
}
