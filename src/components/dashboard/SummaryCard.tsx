import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { MascotBubbleStrip } from '@/components/mascot/MascotBubbleStrip';
import { Card } from '@/components/ui/Card';
import { MacroBarGroup } from '@/components/ui/MacroBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text, type TextTone } from '@/components/ui/Text';
import { useDashboardMascot } from '@/features/mascot/useDashboardMascot';
import { useProfileStore } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { kcalRemaining, progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

/**
 * The day at a glance: a calories-left ring beside target / consumed / burned,
 * with macro progress underneath. The ring fills as the budget is used and
 * turns red once the day is over budget.
 */
export function SummaryCard({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const iconSize = 18;
  const calorieLeftMode = useProfileStore(
    (state) => state.profile?.calorieLeftMode ?? 'smart',
  );

  const remaining = kcalRemaining(
    day.goal.targetKcal,
    day.totals.kcal,
    day.addBackEligibleExerciseKcal,
    calorieLeftMode,
  );
  const isOver = remaining < 0;
  const mascot = useDashboardMascot(day.date === todayKey());

  return (
    <Card className="gap-4">
      <View>
        <View className="flex-row gap-4">
          <ProgressRing
            size={112}
            strokeWidth={10}
            progress={progressFraction(day.totals.kcal, day.totals.kcal + remaining)}
            color={isOver ? colors.danger : undefined}
          >
            <Mascot mascotId="default" action={mascot.action} size={80} />
          </ProgressRing>
          <View className="flex-1 justify-center gap-2">
            <StatRow
              icon={<Ionicons name="flag-outline" size={iconSize} color={colors.fgMuted} />}
              label={t('dashboard', 'target')}
              value={day.goal.targetKcal}
            />
            <StatRow
              icon={
                <Ionicons name="restaurant-outline" size={iconSize} color={colors.fgMuted} />
              }
              label={t('dashboard', 'consumed')}
              value={day.totals.kcal}
            />
            <StatRow
              icon={<Ionicons name="flame-outline" size={iconSize} color={colors.fgMuted} />}
              label={t('dashboard', 'burned')}
              value={day.exerciseKcal}
            />
            <StatRow
              icon={
                <Ionicons
                  name={isOver ? 'alert-circle-outline' : 'battery-half-outline'}
                  size={iconSize}
                  color={isOver ? colors.danger : colors.fgMuted}
                />
              }
              label={t('dashboard', isOver ? 'ringOver' : 'ringLeft')}
              value={Math.abs(remaining)}
              tone={isOver ? 'danger' : undefined}
            />
          </View>
        </View>
        <MascotBubbleStrip bubble={mascot.bubble} onDone={mascot.onBubbleDone} />
      </View>

      <View className="h-px bg-border" />

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
      />
    </Card>
  );
}

function StatRow({
  icon,
  label,
  value,
  unit = 'kcal',
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  tone?: TextTone;
}) {
  return (
    <View className="flex-row items-center gap-2">
      {icon}
      <View className="flex-1">
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <View className="flex-row items-baseline gap-1">
          <Text variant="heading" tone={tone}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Text>
          <Text variant="caption" tone="subtle">
            {unit}
          </Text>
        </View>
      </View>
    </View>
  );
}
