import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { MacroBarGroup } from '@/components/ui/MacroBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { caloriesRemaining, progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

export interface CalorieSummaryCardProps {
  day: DiaryDay;
}

/**
 * The day at a glance: the calorie ring, the eaten/burned arithmetic behind it,
 * and the three macro bars.
 */
export function CalorieSummaryCard({ day }: CalorieSummaryCardProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const consumed = day.totals.calories;
  const remaining = caloriesRemaining(day.goals.calories, consumed, day.exerciseCalories);
  const isOver = remaining < 0;

  const budget = day.goals.calories + day.exerciseCalories;

  return (
    <Card className="items-center gap-5">
      <ProgressRing
        progress={progressFraction(consumed, budget)}
        // Turning the ring red is the one signal that reads instantly; the
        // number below it explains what happened.
        color={isOver ? colors.danger : colors.brand}
      >
        <Text variant="display" tone={isOver ? 'danger' : 'default'}>
          {Math.abs(remaining).toLocaleString()}
        </Text>
        <Text variant="caption" tone="muted">
          {isOver ? 'kcal over' : 'kcal left'}
        </Text>
      </ProgressRing>

      <View className="w-full flex-row justify-around border-t border-border pt-4">
        <Stat label="Goal" value={day.goals.calories} />
        <Stat label="Food" value={consumed} />
        <Stat label="Exercise" value={day.exerciseCalories} />
      </View>

      <MacroBarGroup
        consumed={{
          protein: day.totals.protein,
          carbs: day.totals.carbs,
          fat: day.totals.fat,
        }}
        targets={{
          protein: day.goals.protein,
          carbs: day.goals.carbs,
          fat: day.goals.fat,
        }}
        className="w-full"
      />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="items-center gap-0.5">
      <Text variant="heading">{value.toLocaleString()}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
