import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { GoogleLogo } from '@/components/auth/GoogleLogo';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';

/**
 * Apple keeps its official native button; Google uses a custom button that
 * follows Google's sign-in branding guidelines, so its label follows the app
 * language instead of the phone's. Shared by both `app/(auth)/sign-in.tsx` and `sign-up.tsx`, since a
 * social provider creates-or-signs-in an account in one step.
 */
export function SocialSignInButtons({
  onError,
  onSuccess,
}: {
  onError: (message: string) => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useAppTheme();
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithApple = useAuthStore((state) => state.signInWithApple);

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const runProvider = async (
    provider: 'google' | 'apple',
    action: () => Promise<void>,
  ) => {
    setLoadingProvider(provider);

    try {
      // `action` resolves without throwing on both a genuine sign-in and a
      // plain user cancellation (see `src/features/auth/social.ts`), so the
      // only way to tell them apart here is whether the store's session
      // actually changed. Reference equality, not null-presence, is the
      // right check: a cancellation returns early without ever calling
      // `set()`, so `session` is the exact same reference either way — while
      // a real sign-in always installs a new session object via
      // `persistSession` + `set()`, whether that replaces `null` or an
      // already-signed-in session with a different one (e.g. via a direct
      // deep link into this screen while signed in — `(auth)` routes gate
      // nothing). A presence-only check (`null` vs. non-`null`) would miss
      // that second case.
      const sessionBefore = useAuthStore.getState().session;
      await action();
      const sessionAfter = useAuthStore.getState().session;

      if (sessionAfter !== sessionBefore) onSuccess();
    } catch (error) {
      console.error(`[auth] ${provider} sign-in failed`, error);
      onError(isApiError(error) ? error.userMessage : t('auth', 'genericError'));
    } finally {
      setLoadingProvider(null);
    }
  };

  if (!env.googleWebClientId && !appleAvailable) return null;

  return (
    <View className="gap-3">
      {env.googleWebClientId ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('auth', 'continueWithGoogle')}
          accessibilityState={{ disabled: loadingProvider === 'google' }}
          disabled={loadingProvider === 'google'}
          onPress={() => void runProvider('google', signInWithGoogle)}
          className="h-12 w-full flex-row items-center justify-center gap-3 rounded-card border px-4"
          // Google's own brand colors for its neutral button, not app tokens.
          style={{
            backgroundColor: isDark ? '#131314' : '#FFFFFF',
            borderColor: isDark ? '#8E918F' : '#747775',
            opacity: loadingProvider === 'google' ? 0.6 : 1,
          }}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator size="small" color={isDark ? '#E3E3E3' : '#1F1F1F'} />
          ) : (
            <GoogleLogo />
          )}
          <Text
            variant="label"
            className="text-base"
            numberOfLines={1}
            style={{ color: isDark ? '#E3E3E3' : '#1F1F1F' }}
          >
            {t('auth', 'continueWithGoogle')}
          </Text>
        </PressableScale>
      ) : null}

      {appleAvailable ? (
        // `AppleAuthenticationButtonProps` has no `disabled` prop, so
        // `pointerEvents` is what actually blocks taps while dimmed — the
        // opacity alone is cosmetic.
        <View pointerEvents={loadingProvider === 'apple' ? 'none' : 'auto'}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              isDark
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={8}
            style={{ height: 48, opacity: loadingProvider === 'apple' ? 0.5 : 1 }}
            onPress={() => void runProvider('apple', signInWithApple)}
          />
        </View>
      ) : null}

      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text variant="caption" tone="muted">
          {t('auth', 'orDivider')}
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>
    </View>
  );
}
