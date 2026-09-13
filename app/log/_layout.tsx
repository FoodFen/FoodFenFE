import { Stack } from 'expo-router';

import { useTranslation } from '@/hooks/useTranslation';

/**
 * The logging flow, presented as a modal stack from the root layout.
 *
 * Outside `(tabs)` so it can be opened from any tab and dismissed back to
 * wherever it started.
 */
export default function LogLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="meal" options={{ title: t('logMeal', 'layoutTitle') }} />
      <Stack.Screen name="ingredient" options={{ title: t('logIngredient', 'layoutTitle') }} />
      <Stack.Screen name="search" options={{ title: t('logSearch', 'layoutTitle') }} />
      <Stack.Screen name="manual" options={{ headerShown: false }} />
    </Stack>
  );
}
