import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/text';

export default function Placeholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Hero' }} />
      <Text variant="title">Hero</Text>
    </View>
  );
}
