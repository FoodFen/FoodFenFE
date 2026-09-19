import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';

/**
 * Google and Apple's own official sign-in buttons — never a hand-styled
 * substitute, per both providers' brand/HIG guidelines (see the design
 * spec). Shared by both `app/(auth)/sign-in.tsx` and `sign-up.tsx`, since a
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

  const runProvider = async (provider: 'google' | 'apple', action: () => Promise<void>) => {
    setLoadingProvider(provider);

    try {
      // `action` resolves without throwing on both a genuine sign-in and a
      // plain user cancellation (see `src/features/auth/social.ts`), so the
      // only way to tell them apart here is whether a session now exists.
      const hadSession = useAuthStore.getState().session !== null;
      await action();
      const hasSession = useAuthStore.getState().session !== null;

      if (!hadSession && hasSession) onSuccess();
    } catch (error) {
      onError(isApiError(error) ? error.userMessage : t('auth', 'genericError'));
    } finally {
      setLoadingProvider(null);
    }
  };

  if (!env.googleWebClientId && !appleAvailable) return null;

  return (
    <View className="gap-3">
      {env.googleWebClientId ? (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={isDark ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
          disabled={loadingProvider === 'google'}
          onPress={() => void runProvider('google', signInWithGoogle)}
        />
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

      <View className="flex-row items-center gap-3 py-1">
        <View className="h-px flex-1 bg-border" />
        <Text variant="caption" tone="muted">
          {t('auth', 'orDivider')}
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>
    </View>
  );
}
