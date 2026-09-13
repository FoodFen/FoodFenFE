import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { DASHBOARD_BURN_GOAL_KCAL } from '@/features/dashboard/constants';
import { useLogSheetStore } from '@/features/logging/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MetricSection } from './MetricSection';

/**
 * Active energy for the day.
 *
 * Steps have no data source yet (they need Health Connect / HealthKit), so
 * that row is a placeholder. The workout list is deferred too — for now the
 * section just says whether anything was logged.
 */
export function CaloriesBurnedSection({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const present = useLogSheetStore((state) => state.present);

  return (
    <MetricSection
      title={t('dashboard', 'caloriesBurned')}
      value={day.exerciseKcal}
      onAdd={() => present()}
    >
      <View className="gap-3 pt-1">
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="caption" tone="muted">
              {t('dashboard', 'steps')}
            </Text>
            {/* TODO: real step count from Health Connect / HealthKit. */}
            <Text variant="heading" tone="subtle">
              —
            </Text>
          </View>
          <ProgressRing progress={0} size={44} strokeWidth={4}>
            <Ionicons name="footsteps-outline" size={18} color={colors.fgMuted} />
          </ProgressRing>
        </View>

        {day.exerciseKcal === 0 ? (
          <Text variant="heading" tone="subtle">
            {t('dashboard', 'noWorkouts')}
          </Text>
        ) : null}

        <Text variant="caption" tone="subtle">
          {t('dashboard', 'burnGoal').replace('{kcal}', String(DASHBOARD_BURN_GOAL_KCAL))}
        </Text>
      </View>
    </MetricSection>
  );
}
