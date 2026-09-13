import { Stack } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { useTranslation } from '@/hooks/useTranslation';

/** Placeholder for the coin shop reached from the dashboard header. */
export default function ShopScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: t('shop', 'title') }} />
      <EmptyState
        icon="🛍️"
        title={t('shop', 'emptyTitle')}
        description={t('shop', 'emptyDescription')}
      />
    </View>
  );
}
