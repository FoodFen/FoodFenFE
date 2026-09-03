import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { connectAuthToApiClient, useAuthStore } from '@/features/auth/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useReactQueryBridge } from '@/hooks/useReactQueryBridge';
import { createQueryClient, persistOptions } from '@/lib/queryClient';
import { colorsFor } from '@/theme/colors';

// Hold the splash until fonts are loaded and the session has been read, so the
// app never flashes an unauthenticated frame at a signed-in user.
void SplashScreen.preventAutoHideAsync();

// Created once, outside the component: a new QueryClient on every render would
// throw the cache away on each state change.
const queryClient = createQueryClient();

// The API client needs its auth handlers before any request can fire, and
// module scope is the only place guaranteed to run before the first render.
connectAuthToApiClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const hydrate = useAuthStore((state) => state.hydrate);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    void hydrate().finally(() => setSessionChecked(true));
  }, [hydrate]);

  // A missing font must not brick the app — fall through on `fontError` and
  // render with the system face instead.
  const ready = (fontsLoaded || Boolean(fontError)) && sessionChecked;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <AppShell />
          </KeyboardProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Split from `RootLayout` so it sits inside the providers: `useAppTheme` and
 * the query bridge both need context that the outer component establishes.
 */
function AppShell() {
  const { resolved, isDark } = useAppTheme();
  const colors = colorsFor(resolved);
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');

  useReactQueryBridge();

  // The navigator paints the screen background behind our own views during
  // transitions; without this it flashes white in dark mode.
  //
  // These theming exports come from `expo-router`, not `@react-navigation/native`:
  // since SDK 56 expo-router vendors its own navigation core and importing the
  // React Navigation package directly is a hard bundling error.
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: colors.brand,
      background: colors.bg,
      card: colors.surface,
      text: colors.fg,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.fg,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {/* `Stack.Protected` removes the guarded routes entirely when the guard
            is false, so there is no window in which a signed-out user can be
            deep-linked into the diary. */}
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="log"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="food/[id]" options={{ title: 'Food' }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </ThemeProvider>
  );
}
