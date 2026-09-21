import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ActivityRow } from '@/components/dashboard/ActivityRow';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import * as logRepository from '@/data/logRepository';
import { DASHBOARD_BURN_GOAL_KCAL, DASHBOARD_STEP_GOAL } from '@/features/dashboard/constants';
import { useHealthSteps } from '@/features/dashboard/queries';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { getHealthProvider } from '@/lib/health';
import { progressFraction } from '@/lib/nutrition';
import { queryKeys } from '@/lib/queryClient';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MetricSection } from './MetricSection';

/**
 * Active energy for the day: the health-synced steps row (opt-in, Settings),
 * plus every logged activity — manual and health-derived side by side.
 */
export function CaloriesBurnedSection({ day }: { day: DiaryDay }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const userId = useProfileStore((state) => state.profile?.id ?? null);
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const steps = useHealthSteps(day.date);
  const queryClient = useQueryClient();

  const activities = userId ? logRepository.getActivities(userId, day.date) : [];
  const needsReconnect = healthSyncEnabled && steps.data === null;

  const reconnect = async () => {
    const granted = await getHealthProvider().requestPermissions();

    if (granted) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.health.all });
    }
  };

  return (
    <MetricSection
      title={t('dashboard', 'caloriesBurned')}
      value={day.exerciseKcal}
      onAdd={() => router.push('/log/activity')}
    >
      <View className="gap-3 pt-1">
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="caption" tone="muted">
              {t('dashboard', 'steps')}
            </Text>
            {needsReconnect ? (
              <Pressable onPress={() => void reconnect()}>
                <Text variant="heading" tone="brand">
                  {t('dashboard', 'reconnectHealth')}
                </Text>
              </Pressable>
            ) : (
              <Text variant="heading" tone={steps.data ? 'default' : 'subtle'}>
                {steps.data ? steps.data.steps.toLocaleString() : '—'}
              </Text>
            )}
          </View>
          <ProgressRing
            progress={steps.data ? progressFraction(steps.data.steps, DASHBOARD_STEP_GOAL) : 0}
            size={44}
            strokeWidth={4}
          >
            <Ionicons name="footsteps-outline" size={18} color={colors.fgMuted} />
          </ProgressRing>
        </View>

        {activities.length === 0 ? (
          <Text variant="heading" tone="subtle">
            {t('dashboard', 'noWorkouts')}
          </Text>
        ) : (
          <View className="-mx-4 border-t border-border">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </View>
        )}

        <Text variant="caption" tone="subtle">
          {t('dashboard', 'burnGoal').replace('{kcal}', String(DASHBOARD_BURN_GOAL_KCAL))}
        </Text>
      </View>
    </MetricSection>
  );
}
