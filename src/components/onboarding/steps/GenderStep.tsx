import { View } from 'react-native';

import { OptionList } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';
import type { Gender } from '@/types/models';

export interface GenderStepProps {
  value: Gender;
  onChange: (value: Gender) => void;
}

export function GenderStep({ value, onChange }: GenderStepProps) {
  const { t } = useTranslation();

  const options: { value: Gender; label: string; icon: string }[] = [
    { value: 'male', label: t('onboardingGender', 'male'), icon: '♂️' },
    { value: 'female', label: t('onboardingGender', 'female'), icon: '♀️' },
    { value: 'other', label: t('onboardingGender', 'preferNotToAnswer'), icon: '🙂' },
  ];

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          {t('onboardingGender', 'title')}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {t('onboardingGender', 'subtitle')}
        </Text>
      </View>
      <OptionList options={options} value={value} onChange={onChange} />
    </View>
  );
}
