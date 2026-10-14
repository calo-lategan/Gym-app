import { Stack } from 'expo-router';

import { DungeonScreen } from '@/screens/dungeon';

export default function DungeonRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DungeonScreen />
    </>
  );
}
