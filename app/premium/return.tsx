import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useRefreshSubscription } from '@/features/premium/queries';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Deep-link fallback for `PAYOS_RETURN_URL` (`foodfen://premium/return`).
 *
 * Only reached when the OS delivers the redirect outside an open
 * `WebBrowser.openAuthSessionAsync` call — e.g. the app was backgrounded
 * during checkout and PayOS's redirect relaunches it directly. Landing here
 * re-checks entitlement rather than assuming success, same as the payment
 * screen's own polling does; a `returnUrl` hit only means the checkout page
 * closed, not that the webhook has necessarily been processed yet.
 */
export default function PremiumReturnScreen() {
  const { t } = useTranslation();
  const refreshSubscription = useRefreshSubscription();

  useEffect(() => {
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
