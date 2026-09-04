import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { MacroBarGroup } from '@/components/ui/MacroBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { kcalRemaining, progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

export interface CalorieSummaryCardProps {
  day: DiaryDay;
}

/**
 * The day at a glance: the calorie ring, the arithmetic behind it, and the
 * three macro bars.
 */
export function CalorieSummaryCard({ day }: CalorieSummaryCardProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const consumed = day.totals.kcal;
  const remaining = kcalRemaining(day.goal.targetKcal, consumed, day.exerciseKcal);
  const isOver = remaining < 0;

  const budget = day.goal.targetKcal + day.exerciseKcal;

  return (
    <Card className="items-center gap-5">
      <ProgressRing
        progress={progressFraction(consumed, budget)}
        // Turning the ring red is the one signal that reads instantly; the
        // number inside it explains what happened.
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
        <Stat label="Goal" value={day.goal.targetKcal} />
        <Stat label="Food" value={consumed} />
        <Stat label="Exercise" value={day.exerciseKcal} />
      </View>

      <MacroBarGroup
        consumed={{
          proteinG: day.totals.proteinG,
          carbsG: day.totals.carbsG,
          fatG: day.totals.fatG,
        }}
        targets={{
          proteinG: day.goal.targetProteinG,
          carbsG: day.goal.targetCarbsG,
          fatG: day.goal.targetFatG,
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
