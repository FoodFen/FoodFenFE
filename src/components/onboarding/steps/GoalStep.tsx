import { View } from 'react-native';

import { WeightWheel } from '@/components/onboarding/steps/WeightStep';
import { ChipRow } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import type { GoalDirection } from '@/lib/nutrition';
import type { UnitSystem } from '@/types/models';

const DIRECTION_OPTIONS: { value: GoalDirection; label: string }[] = [
  { value: 'lose', label: 'Lose' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain' },
];

export interface GoalStepProps {
  unitSystem: UnitSystem;
  direction: GoalDirection;
  /** Always in kg. Ignored (and hidden) while `direction` is `maintain`. */
  weightGoal: number;
  onChangeDirection: (direction: GoalDirection) => void;
  onChangeWeightGoal: (kg: number) => void;
}

export function GoalStep({
  unitSystem,
  direction,
  weightGoal,
  onChangeDirection,
  onChangeWeightGoal,
}: GoalStepProps) {
  return (
    <View className="w-full items-center gap-6">
      <Text variant="title" className="text-center text-3xl">
        What&apos;s your goal?
      </Text>
      <ChipRow options={DIRECTION_OPTIONS} value={direction} onChange={onChangeDirection} />

      {direction !== 'maintain' ? (
        <View className="items-center gap-2">
          <Text variant="label" tone="muted">
            Goal weight
          </Text>
          <WeightWheel unitSystem={unitSystem} value={weightGoal} onChange={onChangeWeightGoal} />
        </View>
      ) : null}
    </View>
  );
}
