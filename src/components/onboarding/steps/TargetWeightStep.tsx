import { View } from 'react-native';

import { WeightWheel } from '@/components/onboarding/steps/WeightStep';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';
import type { UnitSystem } from '@/types/models';

export interface TargetWeightStepProps {
  unitSystem: UnitSystem;
  /** Always in kg. */
  value: number;
  onChange: (kg: number) => void;
}

/**
 * Just the number — no lose/maintain/gain choice. `goalDirection()` in
 * `src/lib/nutrition.ts` derives that from comparing this to the current
 * weight, so asking for it separately would only risk the two disagreeing.
 * The wheel opens on the current weight, so leaving it untouched reads as
 * "maintain" without a dedicated option for it.
 */
export function TargetWeightStep({ unitSystem, value, onChange }: TargetWeightStepProps) {
  const { t } = useTranslation();

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          {t('onboardingGoal', 'title')}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {t('onboardingGoal', 'subtitle')}
        </Text>
      </View>
      <WeightWheel unitSystem={unitSystem} value={value} onChange={onChange} />
    </View>
  );
}
