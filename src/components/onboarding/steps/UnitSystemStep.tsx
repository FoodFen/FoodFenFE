import { View } from 'react-native';

import { ChipRow } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import type { UnitSystem } from '@/types/models';

const UNIT_SYSTEM_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (cm, kg)' },
  { value: 'imperial', label: 'Imperial (ft/in, lb)' },
];

export interface UnitSystemStepProps {
  value: UnitSystem;
  onChange: (value: UnitSystem) => void;
}

export function UnitSystemStep({ value, onChange }: UnitSystemStepProps) {
  return (
    <View className="w-full items-center gap-6">
      <Text variant="title" className="text-center text-3xl">
        Which units do you use?
      </Text>
      <ChipRow options={UNIT_SYSTEM_OPTIONS} value={value} onChange={onChange} />
    </View>
  );
}
