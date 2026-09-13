import * as Notifications from 'expo-notifications';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

export interface NotificationsStepProps {
  onChange: (value: boolean) => void;
  /** Each button is a direct action, not a toggle — pressing either advances the wizard. */
  onDone: () => void;
}

export function NotificationsStep({ onChange, onDone }: NotificationsStepProps) {
  const { t } = useTranslation();

  return (
    <View className="w-full items-center gap-6">
      <Text variant="title" className="w-full text-center text-3xl">
        {t('onboardingNotifications', 'title')}
      </Text>
      <Text variant="body" tone="muted" className="text-center">
        {t('onboardingNotifications', 'subtitle')}
      </Text>

      <View className="w-full flex-row gap-3">
        <Button
          label={t('common', 'enable')}
          variant="primary"
          className="flex-1"
          onPress={() => {
            void Notifications.requestPermissionsAsync().then(({ granted }) => {
              onChange(granted);
              onDone();
            });
          }}
        />
        <Button
          label={t('common', 'skip')}
          variant="secondary"
          className="flex-1"
          onPress={() => {
            onChange(false);
            onDone();
          }}
        />
      </View>
    </View>
  );
}
