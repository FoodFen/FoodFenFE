import { Stack } from 'expo-router';

import { useAuthStore } from '@/features/auth/store';
import { useAiQuota } from '@/features/diary/queries';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';

/**
 * The logging flow, presented as a modal stack from the root layout.
 *
 * Outside `(tabs)` so it can be opened from any tab and dismissed back to
 * wherever it started.
 */
export default function LogLayout() {
  const { t } = useTranslation();
  const signedIn = useAuthStore((state) => state.session !== null);
  useAiQuota(env.hasBackend, signedIn);

  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="meal" options={{ title: t('logMeal', 'layoutTitle') }} />
      <Stack.Screen
        name="ingredient"
        options={{ title: t('logIngredient', 'layoutTitle') }}
      />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="manual" options={{ headerShown: false }} />
      <Stack.Screen name="activity" options={{ headerShown: false }} />
      <Stack.Screen
        name="interstitial"
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack>
  );
}
