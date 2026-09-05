import { View } from 'react-native';

import { WheelPicker } from '@/components/onboarding/WheelPicker';
import { Text } from '@/components/ui/Text';
import { units } from '@/features/settings/store';
import type { UnitSystem } from '@/types/models';

const KG_OPTIONS = Array.from({ length: 171 }, (_, i) => {
  const kg = i + 30; // 30–200 kg
  return { value: kg, label: `${kg} kg` };
});

const LB_OPTIONS = Array.from({ length: 375 }, (_, i) => {
  const lb = i + 66; // 66–440 lb
  return { value: lb, label: `${lb} lb` };
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
      />
    );
  }

  return <WheelPicker data={KG_OPTIONS} value={Math.round(value)} onChange={onChange} />;
}

export interface WeightStepProps {
  unitSystem: UnitSystem;
  value: number;
  onChange: (kg: number) => void;
}

export function WeightStep({ unitSystem, value, onChange }: WeightStepProps) {
  return (
    <View className="gap-4">
      <Text variant="title">What&apos;s your current weight?</Text>
      <WeightWheel unitSystem={unitSystem} value={value} onChange={onChange} />
    </View>
  );
}
