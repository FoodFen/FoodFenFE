import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { WheelPicker } from '@/components/ui/WheelPicker';
import type { WeightUnit } from '@/features/settings/store';

const RANGE: Record<WeightUnit, { min: number; max: number }> = {
  kg: { min: 20, max: 300 },
  lb: { min: 44, max: 660 },
};

function wholeOptions(min: number, max: number) {
  return Array.from({ length: max - min + 1 }, (_, i) => ({
    value: min + i,
    label: String(min + i),
  }));
}

const WHOLE_OPTIONS: Record<WeightUnit, ReturnType<typeof wholeOptions>> = {
  kg: wholeOptions(RANGE.kg.min, RANGE.kg.max),
  lb: wholeOptions(RANGE.lb.min, RANGE.lb.max),
};

const TENTHS_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ value: i, label: String(i) }));

export interface WeightWheelsProps {
  unit: WeightUnit;
  /** The weight in `unit`, as an integer count of tenths (72.4 → 724). */
  tenths: number;
  onChange: (tenths: number) => void;
}

/** Whole part on the left wheel, one decimal on the right. */
export function WeightWheels({ unit, tenths, onChange }: WeightWheelsProps) {
  const { min, max } = RANGE[unit];
  const clamped = Math.min(max * 10 + 9, Math.max(min * 10, tenths));
  const whole = Math.floor(clamped / 10);
  const decimal = clamped % 10;

  return (
    <View className="flex-row items-center justify-center gap-2">
      <WheelPicker
        data={WHOLE_OPTIONS[unit]}
        value={whole}
        onChange={(next) => onChange(next * 10 + decimal)}
        width={96}
      />
      <Text variant="heading" tone="brand" className="text-3xl">
        .
      </Text>
      <WheelPicker
        data={TENTHS_OPTIONS}
        value={decimal}
        onChange={(next) => onChange(whole * 10 + next)}
        width={72}
      />
      <Text variant="heading" tone="brand" className="text-xl">
        {unit}
      </Text>
    </View>
  );
}
