import { View } from 'react-native';

import { WheelPicker } from '@/components/onboarding/WheelPicker';
import { Text } from '@/components/ui/Text';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 100;
const MAX_YEAR = CURRENT_YEAR - 10;

const YEAR_OPTIONS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => {
  const year = MIN_YEAR + i;
  return { value: year, label: String(year) };
});

export interface BirthYearStepProps {
  value: number;
  onChange: (value: number) => void;
}

export function BirthYearStep({ value, onChange }: BirthYearStepProps) {
  return (
    <View className="w-full items-center gap-6">
      <Text variant="title" className="w-full text-center text-3xl">
        What year were you born?
      </Text>
      <WheelPicker data={YEAR_OPTIONS} value={value} onChange={onChange} />
    </View>
  );
}
