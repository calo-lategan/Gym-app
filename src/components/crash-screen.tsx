import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { updateSettings } from '@/state/actions';
import { colors, radius, spacing, touch } from '@/theme';

import { Text } from './text';

function details(error: Error) {
  const head = `${error.name}: ${error.message}`;
  const stack = error.stack ?? '';
  // Most engines start the stack with the message line already.
  const lines = (stack.startsWith(head) ? stack : `${head}\n${stack}`).split('\n');
  return lines.slice(0, 7).join('\n').trim();
}

function Action({ title, onPress, primary = false }: { title: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touch.min,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        backgroundColor: primary ? colors.torch : colors.slate,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.seam,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text variant="headline" color={primary ? colors.onTorch : colors.bone}>
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * Shown instead of closing the app when something breaks. Kept free of sound,
 * haptics and 3D so it still works when one of those is what failed.
 */
export function CrashScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  const text = details(error);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.abyss }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      testID="crash-screen"
    >
      <Text variant="title">Something went wrong</Text>
      <Text variant="subhead">Ironwyrm hit an error it could not recover from. Your hero and history are safe on this phone.</Text>
      <Action title="Try again" primary onPress={onRetry} />
      <Action
        title="Turn off 3D and try again"
        onPress={() => {
          updateSettings({ graphics: 'lite' });
          onRetry();
        }}
      />
      <Action title="Share error details" onPress={() => void Share.share({ message: `Ironwyrm error\n\n${text}` }).catch(() => undefined)} />
      <View style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.stone, borderWidth: 1, borderColor: colors.seam }}>
        <Text variant="caption" selectable>
          {text}
        </Text>
      </View>
    </ScrollView>
  );
}
