import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { WaterCup } from '@/components/dashboard/WaterCup';
import { Text } from '@/components/ui/Text';
import { GLASS_ML } from '@/features/dashboard/constants';
import { useSetWaterTotal } from '@/features/diary/queries';
import { useLogSheetStore } from '@/features/logging/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MetricSection } from './MetricSection';

/**
 * Water for the day, drawn as a row of cups (UC-20/UC-21).
 *
 * Each cup shows its real fill level, not just filled/empty — a custom
 * amount rarely lands on an exact multiple of a cup. Tapping cup *i* sets the
 * day's total to `(i + 1) * GLASS_ML`, so the user only ever thinks in terms
 * of "how many cups today", never individual log entries. The "+" opens the
 * log sheet's wheel picker for a precise custom amount; "..." opens the
 * water-goal editor.
 */
export function WaterSection({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const present = useLogSheetStore((state) => state.present);
  const setWaterTotal = useSetWaterTotal();

  const targetMl = day.goal.targetWaterMl;
  const glassCount = Math.max(Math.round(targetMl / GLASS_ML), 1);
  const filled = Math.min(Math.round(day.waterMl / GLASS_ML), glassCount);

  const setCups = (cupCount: number) => {
    haptics.selection();
    setWaterTotal.mutate({ targetMl: cupCount * GLASS_ML, date: day.date });
  };

  return (
    <MetricSection
      title={t('dashboard', 'water')}
      value={day.waterMl.toLocaleString()}
      unit="ml"
      onAdd={() => present('water')}
    >
      <View className="gap-3 pt-1">
        <View className="flex-row flex-wrap gap-2">
          {Array.from({ length: glassCount }).map((_, index) => (
            <WaterCup
              key={index}
              fillFraction={(day.waterMl - index * GLASS_ML) / GLASS_ML}
              showAddGlyph={index === filled}
              onPress={() => setCups(index + 1)}
            />
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="subtle">
            {t('dashboard', 'waterGoal').replace('{ml}', targetMl.toLocaleString())}
          </Text>
          <Pressable
            onPress={() => present('waterGoal')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard', 'editWaterGoalA11y')}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.fgSubtle} />
          </Pressable>
        </View>
      </View>
    </MetricSection>
  );
}
