import { View } from 'react-native';

import { ChipRow } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';

const RATE_VALUES = [0.25, 0.5, 0.75, 1];
const WEEKS_PER_MONTH = 4.345;

/** Chips still carry a kg/week rate (what's stored); only the label is time. */
function formatDuration(weeks: number): string {
  if (weeks < 8) return `${Math.max(1, Math.round(weeks))} weeks`;

  const months = Math.round(weeks / WEEKS_PER_MONTH);

  return months === 1 ? '1 month' : `${months} months`;
}

export interface RateStepProps {
  value: number;
  onChange: (value: number) => void;
  /** Always in kg. Used only to turn each rate into an estimated duration. */
  weightCurrent: number;
  weightGoal: number;
}

/** Shown only when the goal step's direction isn't `maintain`. */
export function RateStep({ value, onChange, weightCurrent, weightGoal }: RateStepProps) {
  const deltaKg = Math.abs(weightGoal - weightCurrent);

  const options = RATE_VALUES.map((rate) => ({
    value: rate,
    label: formatDuration(deltaKg / rate),
  }));

  return (
    <View className="w-full items-center gap-6">
      <Text variant="title" className="w-full text-center text-3xl">
        How fast do you want to get there?
      </Text>
      <ChipRow options={options} value={value} onChange={onChange} fullWidth />
    </View>
  );
}
