import { Stack } from 'expo-router';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/**
 * Sign in and sign up.
 *
 * Pushed from the welcome screen or Profile rather than gating the app, so
 * these screens show a header with a back button — a user who opened them by
 * mistake has to be able to leave without an account. The header blends into
 * the page background and shows no title; the page's own heading carries it.
 */
export default function AuthLayout() {
  const { t } = useTranslation();
  const colors = colorsFor(useAppTheme().resolved);

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.bg },
        headerTitle: '',
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: t('auth', 'signInTitle') }} />
      <Stack.Screen name="sign-up" options={{ title: t('auth', 'createAccountTitle') }} />
    </Stack>
  );
}
