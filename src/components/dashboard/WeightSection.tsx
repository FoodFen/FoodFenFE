import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useWeightAsOf } from '@/features/dashboard/queries';
import { useLogSheetStore } from '@/features/logging/store';
import { useProfileStore } from '@/features/profile/store';
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

  if (!user) return null;

  const currentWeight = logged?.weight ?? user.weightCurrent;
  const remaining = currentWeight - user.weightGoal;
  // Display rounding only — one decimal place, absolute value.
  const deltaLabel = String(Math.round(Math.abs(remaining) * 10) / 10);

  const remainingCaption =
    Math.abs(remaining) < AT_GOAL_BAND_KG
      ? t('dashboard', 'weightReached')
      : t('dashboard', 'weightToGo').replace('{delta}', deltaLabel);

  return (
    <MetricSection
      title={t('dashboard', 'weight')}
      value={currentWeight}
      unit="kg"
      onAdd={() => present('weight')}
    >
      <View className="gap-1 pt-1">
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="subtle">
            {t('dashboard', 'weightGoal').replace('{weight}', String(user.weightGoal))}
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
