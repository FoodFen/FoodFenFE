import { View } from 'react-native';

import { OptionList } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';
import type { UnitSystem } from '@/types/models';

export interface UnitSystemStepProps {
  value: UnitSystem;
  onChange: (value: UnitSystem) => void;
}

export function UnitSystemStep({ value, onChange }: UnitSystemStepProps) {
  const { t } = useTranslation();

  const options: { value: UnitSystem; label: string }[] = [
    { value: 'metric', label: t('onboardingUnitSystem', 'metric') },
    { value: 'imperial', label: t('onboardingUnitSystem', 'imperial') },
  ];

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          {t('onboardingUnitSystem', 'title')}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {t('onboardingUnitSystem', 'subtitle')}
        </Text>
      </View>
      <OptionList options={options} value={value} onChange={onChange} />
    </View>
  );
}
