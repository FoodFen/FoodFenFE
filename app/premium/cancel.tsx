import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Deep-link fallback for `PAYOS_CANCEL_URL` (`foodfen://premium/cancel`).
 *
 * Reached when the user backs out of PayOS's checkout page and the OS
 * delivers the redirect outside an open `WebBrowser.openAuthSessionAsync`
 * call (app backgrounded during checkout). No status check needed here —
 * backing out never pays — just return to wherever Premium was opened from.
 */
export default function PremiumCancelScreen() {
  const { t } = useTranslation();

  useEffect(() => {
    router.dismiss();
  }, []);

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-bg">
      <ActivityIndicator />
      <Text variant="body" tone="muted">
        {t('common', 'cancel')}
      </Text>
    </View>
  );
}
