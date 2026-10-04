import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useWeightAsOf } from '@/features/dashboard/queries';
import { useLogSheetStore } from '@/features/logging/store';
import { useProfileStore } from '@/features/profile/store';
import { units, useSettingsStore } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MetricSection } from './MetricSection';

/** kg from goal within which the weight reads as "at goal" — matches `goalDirection`. */
const AT_GOAL_BAND_KG = 0.5;

/**
 * Day-scoped weigh-in against the goal.
 *
 * The headline number is the weigh-in in force as of the selected day, falling
 * back to the profile's current weight before anything has been logged. The goal
 * weight is not day-scoped — there is no goal-weight history. The caption shows
 * the goal and the remaining distance to it ("to go", neutral of direction).
 */
export function WeightSection({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const user = useProfileStore((state) => state.profile);
  const present = useLogSheetStore((state) => state.present);
  const { data: logged } = useWeightAsOf(day.date);
  const weightUnit = useSettingsStore((state) => state.weightUnit);

  if (!user) return null;

  // Canonical storage and the "at goal" band are always kg; only the numbers
  // shown on screen convert to the device's unit.
  const currentWeightKg = logged?.weight ?? user.weightCurrent;
  const remainingKg = currentWeightKg - user.weightGoal;

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const displayWeight = round1(units.weightFromKg(currentWeightKg, weightUnit));
  const displayGoal = round1(units.weightFromKg(user.weightGoal, weightUnit));
  const deltaLabel = String(
    round1(units.weightFromKg(Math.abs(remainingKg), weightUnit)),
  );

  const remainingCaption =
    Math.abs(remainingKg) < AT_GOAL_BAND_KG
      ? t('dashboard', 'weightReached')
      : t('dashboard', 'weightToGo').replace('{delta}', deltaLabel);

  return (
    <MetricSection
      title={t('dashboard', 'weight')}
      value={String(displayWeight)}
      unit={weightUnit}
      onAdd={() => present('weight')}
    >
      <View className="gap-1 pt-1">
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="subtle">
            {t('dashboard', 'weightGoal').replace('{weight}', String(displayGoal))}
          </Text>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.fgSubtle} />
        </View>
        <Text variant="caption" tone="subtle">
          {remainingCaption}
        </Text>
      </View>
    </MetricSection>
  );
}
