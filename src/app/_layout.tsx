import { GrenzeGotisch_600SemiBold, GrenzeGotisch_700Bold, GrenzeGotisch_800ExtraBold, useFonts } from '@expo-google-fonts/grenze-gotisch';
import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CrashScreen } from '@/components/crash-screen';
import { ToastHost } from '@/components/toast';
import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { sheetOptions } from '@/navigation/options';
import { clearCrash, installCrashHandler, markAppOnScreen, useCrash } from '@/services/crash';
import { recoverFromSceneCrash } from '@/state/actions';
import { useGame } from '@/state/stores';
import { colors, fonts } from '@/theme';

installCrashHandler();
recoverFromSceneCrash();
void SplashScreen.preventAutoHideAsync();

/** Render errors anywhere in the app land here instead of closing it. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} onRetry={() => void retry()} />;
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.torch,
    background: colors.abyss,
    card: colors.abyss,
    text: colors.bone,
    border: colors.seam,
    notification: colors.ember,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    GrenzeGotisch_600SemiBold,
    GrenzeGotisch_700Bold,
    GrenzeGotisch_800ExtraBold,
  });
  const onboarded = useGame((s) => s.onboarded);
  const crash = useCrash((s) => s.error);
  const ready = fontsLoaded || Boolean(fontError);
  useAppLifecycle(ready && onboarded);

  useEffect(() => {
    markAppOnScreen();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (crash) return <CrashScreen error={crash} onRetry={clearCrash} />;
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.abyss }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.abyss }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.abyss },
            headerTintColor: colors.bone,
            headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 22 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.abyss },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="check-in" options={{ title: 'Before you fight', presentation: 'modal' }} />
            <Stack.Screen name="workout" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="victory" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="lair" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="swap" options={sheetOptions()} />
            <Stack.Screen name="exercise-picker" options={sheetOptions()} />
            <Stack.Screen name="weigh-in" options={sheetOptions([0.55])} />
            <Stack.Screen name="move-session" options={sheetOptions([0.6])} />
            <Stack.Screen name="item/[id]" options={sheetOptions([0.55])} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="science" options={{ title: 'The science' }} />
            <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
            <Stack.Screen name="history" options={{ title: 'Battle log' }} />
            <Stack.Screen name="records" options={{ title: 'Records' }} />
            <Stack.Screen name="shop" options={{ title: 'Merchant' }} />
            <Stack.Screen name="slay" options={{ title: 'A new foe', presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
