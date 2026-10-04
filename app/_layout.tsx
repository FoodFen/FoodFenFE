import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QuestToast } from '@/components/gamification/QuestToast';
import { LogSheet } from '@/components/logging/LogSheet';
import { ErrorState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { clearSeededDays, seedRecentDays } from '@/data/devSeed';
import { db, enableForeignKeys } from '@/db/client';
import { connectAuthToApiClient, connectAuthToSync, useAuthStore } from '@/features/auth/store';
import { reconcileNotifications } from '@/features/notifications/reconcile';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePushSync } from '@/hooks/usePushSync';
import { useReactQueryBridge } from '@/hooks/useReactQueryBridge';
import { useSubscriptionSync } from '@/hooks/useSubscriptionSync';
import { useTranslation } from '@/hooks/useTranslation';
import { createQueryClient, persistOptions, queryKeys } from '@/lib/queryClient';
import { colorsFor } from '@/theme/colors';

import migrations from '../drizzle/migrations';

// Hold the splash until fonts, migrations, the stored session and the first
// profile read are all resolved, so the first frame is the real one.
void SplashScreen.preventAutoHideAsync();

// Created once, outside the component: a new QueryClient on every render would
// throw the cache away on each state change.
const queryClient = createQueryClient();

// The API client needs its auth handlers before any request can fire, and
// module scope is the only place guaranteed to run before the first render.
// An account is optional, but the wiring still has to exist for when one is used.
connectAuthToApiClient();
connectAuthToSync();

// Cached tier/diary/quest results belong to the previous account.
useAuthStore.subscribe((state, prev) => {
  if (prev.status !== 'loading' && state.session?.user.id !== prev.session?.user.id) {
    void queryClient.resetQueries();
  }
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Nothing may query the database until this reports success — on a fresh
  // install the tables do not exist until it has run.
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);

  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const refreshProfile = useProfileStore((state) => state.refresh);
  const profileLoaded = useProfileStore((state) => state.isLoaded);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    void hydrateAuth().finally(() => setSessionChecked(true));
  }, [hydrateAuth]);

  // The first read of the local profile, deliberately after migrations rather
  // than at store construction.
  useEffect(() => {
    if (!migrated) return;

    enableForeignKeys();
    refreshProfile();
  }, [migrated, refreshProfile]);

  // A missing font must not brick the app — fall through on `fontError` and
  // render with the system face instead. A failed migration is different: the
  // app has no data layer at all, so it says so rather than crashing on the
  // first query.
  const ready =
    (fontsLoaded || Boolean(fontError)) &&
    sessionChecked &&
    (Boolean(migrationError) || (migrated && profileLoaded));

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (migrationError) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 justify-center bg-bg">
          <MigrationError message={migrationError.message} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <AppShell migrated={migrated} />
          </KeyboardProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

function MigrationError({ message }: { message: string }) {
  const { t } = useTranslation();

  return (
    <ErrorState
      title={t('dataError', 'title')}
      description={t('dataError', 'description').replace('{message}', message)}
    />
  );
}

/**
 * Split from `RootLayout` so it sits inside the providers: `useAppTheme` and
 * the query bridge both need context that the outer component establishes.
 */
function AppShell({ migrated }: { migrated: boolean }) {
  const { t } = useTranslation();
  const { resolved, isDark } = useAppTheme();
  const colors = colorsFor(resolved);

  // The local profile — not an account — decides what the user sees. FoodFen
  // works fully offline: this reflects only whether the one-time onboarding
  // has been completed on this device, never whether anyone is signed in.
  const profileId = useProfileStore((state) => state.profile?.id ?? null);
  const hasProfile = profileId !== null;

  const devSeedEnabled = useSettingsStore((state) => state.devSeedEnabled);
  const queryClient = useQueryClient();

  useReactQueryBridge();
  usePushSync();
  useSubscriptionSync();

  // Dev-only: fill the last few days so the dashboard has data to render while
  // food logging is unbuilt. The whole effect no-ops in a release build.
  // Turning the Settings → Developer toggle off wipes the last-3-days window
  // (dev-only; there is no real diary data there yet).
  useEffect(() => {
    if (!__DEV__ || !migrated || !profileId) return;

    if (devSeedEnabled) seedRecentDays(profileId);
    else clearSeededDays(profileId);

    void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });
  }, [migrated, devSeedEnabled, profileId, queryClient]);

  // Re-evaluate meal/streak notifications once the profile is available —
  // covers first boot, and a profile appearing right after onboarding.
  useEffect(() => {
    if (!migrated || !profileId) return;

    void reconcileNotifications(profileId);
  }, [migrated, profileId]);

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
            is false. Onboarding — not signing in — is the only thing between a
            fresh install and the diary. */}
        <Stack.Protected guard={!hasProfile}>
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={hasProfile}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="log"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="entry/[id]"
            options={{ title: t('entryDetail', 'layoutTitle') }}
          />
          <Stack.Screen
            name="entry/edit/[id]"
            options={{ title: t('entryEdit', 'layoutTitle') }}
          />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen
            name="premium"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="shop" options={{ title: t('shop', 'title') }} />
          <Stack.Screen name="streak" options={{ title: t('streak', 'title') }} />
          <Stack.Screen name="quiz" options={{ headerShown: false }} />
          <Stack.Screen
            name="chat"
            options={{ title: t('chat', 'layoutTitle'), presentation: 'modal' }}
          />
        </Stack.Protected>

        {/* Reachable at any time from Profile — "sign in to sync" — and gating
            nothing. */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        <Stack.Screen
          name="+not-found"
          options={{ title: t('notFound', 'layoutTitle') }}
        />
      </Stack>

      {/* One instance for the whole app: the tab-bar "+" and every dashboard
          card's "+" open this same sheet through `useLogSheetStore`. */}
      <LogSheet />
      {/* Decorative — a bug in here must never be able to take the navigator
          down with it. */}
      <ErrorBoundary name="QuestToast">
        <QuestToast />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
