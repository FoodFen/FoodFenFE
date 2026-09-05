import * as Notifications from 'expo-notifications';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export interface NotificationsStepProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function NotificationsStep({ value, onChange }: NotificationsStepProps) {
  return (
    <View className="w-full items-center gap-6">
      <Text variant="title" className="text-center text-3xl">
        Stay on track
      </Text>
      <Text variant="body" tone="muted" className="text-center">
        We can remind you to log meals and celebrate streaks. You can change this anytime
        in Settings.
      </Text>

      <View className="w-full flex-row gap-3">
        <Button
          label="Enable"
          variant={value ? 'primary' : 'secondary'}
          className="flex-1"
          onPress={() => {
            void Notifications.requestPermissionsAsync().then(({ granted }) => {
              onChange(granted);
            });
          }}
        />
        <Button
          label="Skip"
          variant={value ? 'secondary' : 'primary'}
          className="flex-1"
          onPress={() => onChange(false)}
        />
      </View>
    </View>
  );
}
