import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { WheelPicker } from '@/components/ui/WheelPicker';
import { units } from '@/features/settings/store';
import { useTranslation } from '@/hooks/useTranslation';
import type { UnitSystem } from '@/types/models';

// Wheel rows carry only the number — the unit shows once, as a static label
// beside the wheel, not repeated on every row.
const KG_OPTIONS = Array.from({ length: 171 }, (_, i) => {
  const kg = i + 30; // 30–200 kg
  return { value: kg, label: String(kg) };
});

const LB_OPTIONS = Array.from({ length: 375 }, (_, i) => {
  const lb = i + 66; // 66–440 lb
  return { value: lb, label: String(lb) };
});

export interface WeightWheelProps {
  unitSystem: UnitSystem;
  /** Always in kg, converted for display when the unit system is imperial. */
  value: number;
  onChange: (kg: number) => void;
}

/** A single weight wheel, unit-aware. Reused for both current and goal weight. */
export function WeightWheel({ unitSystem, value, onChange }: WeightWheelProps) {
  if (unitSystem === 'imperial') {
    const lb = Math.round(units.weightFromKg(value, 'lb'));

    return (
      <WheelPicker
        data={LB_OPTIONS}
        value={lb}
        onChange={(nextLb) => onChange(units.weightToKg(nextLb, 'lb'))}
        sideLabel={` lb`}
      />
    );
  }

  const kg = Math.round(value);

  return (
    <WheelPicker
      data={KG_OPTIONS}
      value={kg}
      onChange={onChange}
      sideLabel={` kg`}
    />
  );
}

export interface WeightStepProps {
  unitSystem: UnitSystem;
  value: number;
  onChange: (kg: number) => void;
}

export function WeightStep({ unitSystem, value, onChange }: WeightStepProps) {
  const { t } = useTranslation();

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          {t('onboardingWeight', 'title')}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {t('onboardingWeight', 'subtitle')}
        </Text>
      </View>
      <WeightWheel unitSystem={unitSystem} value={value} onChange={onChange} />
    </View>
  );
}
