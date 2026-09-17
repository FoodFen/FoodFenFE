import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * "How it affects daily calories" (UC-25 / spec §3.6).
 *
 * `calorie_left_mode` only decides whether `kcalRemaining` adds logged
 * exercise back into today's budget — it never touches `target_kcal` itself,
 * which is set separately under Target calculation (`calorie_calc_mode`).
 */
export default function SmartModeExplainerScreen() {
  const { t } = useTranslation();

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: t('smartMode', 'title') }} />

      <Text variant="body" tone="muted">
        {t('smartMode', 'intro')}
      </Text>

      <Card className="gap-4">
        <View className="gap-1">
          <Text variant="heading">{t('smartMode', 'smartHeading')}</Text>
          <Text variant="body" tone="muted">
            {t('smartMode', 'smartDescription')}
          </Text>
        </View>

        <View className="gap-1 border-t border-border pt-4">
          <Text variant="heading">{t('smartMode', 'allCaloriesHeading')}</Text>
          <Text variant="body" tone="muted">
            {t('smartMode', 'allCaloriesDescription')}
          </Text>
        </View>
      </Card>
    </ScrollScreen>
  );
}
