import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useRefreshSubscription } from '@/features/premium/queries';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Deep-link landing for `foodfen://premium/return` — where PayOS and MoMo
 * send the user after checkout.
 *
 * When it lands on top of an open payment screen, that screen is already
 * polling and owns navigation, so this just steps back to it. Only on a cold
 * launch (nothing to go back to) does it re-check entitlement itself — and
 * even then it doesn't assume success: a redirect only means the checkout
 * page closed, not that the webhook has necessarily been processed yet.
 */
export default function PremiumReturnScreen() {
  const { t } = useTranslation();
  const refreshSubscription = useRefreshSubscription();

  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    refreshSubscription.mutate(undefined, {
      onSuccess: (result) => {
        if (result.hasActiveSubscription) {
          router.dismissAll();
          router.replace('/premium/welcome');
        } else {
          router.dismiss();
        }
      },
      onError: () => router.dismiss(),
    });
    // Runs once, on landing — see the file doc comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-bg">
      <ActivityIndicator />
      <Text variant="body" tone="muted">
        {t('premiumPayment', 'waitingTitle')}
      </Text>
    </View>
  );
}
