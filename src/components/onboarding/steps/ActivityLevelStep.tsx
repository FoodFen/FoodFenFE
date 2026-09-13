import { View } from 'react-native';

import { ActivityLevelList } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';
import type { ActivityLevel } from '@/types/models';

export interface ActivityLevelStepProps {
  value: ActivityLevel;
  onChange: (value: ActivityLevel) => void;
}

export function ActivityLevelStep({ value, onChange }: ActivityLevelStepProps) {
  const { t } = useTranslation();

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          {t('onboardingActivity', 'title')}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {t('onboardingActivity', 'subtitle')}
        </Text>
      </View>
      <View className="w-full">
        <ActivityLevelList value={value} onChange={onChange} />
      </View>
    </View>
  );
}
