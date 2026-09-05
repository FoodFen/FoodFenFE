import { View } from 'react-native';

import { ChipRow } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';

const RATE_OPTIONS = [0.25, 0.5, 0.75, 1].map((rate) => ({
  value: rate,
  label: `${rate} kg`,
}));

export interface RateStepProps {
  value: number;
  onChange: (value: number) => void;
}

/** Shown only when the goal step's direction isn't `maintain`. */
export function RateStep({ value, onChange }: RateStepProps) {
  return (
    <View className="gap-4">
      <Text variant="title">How fast do you want to get there?</Text>
      <ChipRow options={RATE_OPTIONS} value={value} onChange={onChange} />
    </View>
  );
}
