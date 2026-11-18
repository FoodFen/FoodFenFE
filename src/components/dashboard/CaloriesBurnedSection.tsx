import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { ActivityRow } from '@/components/dashboard/ActivityRow';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { DASHBOARD_BURN_GOAL_KCAL, DASHBOARD_STEP_GOAL } from '@/features/dashboard/constants';
import { useActivities, useHealthSteps } from '@/features/dashboard/queries';
import { useEnergy, useSettingsStore } from '@/features/settings/store';
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
  const energy = useEnergy();
  const colors = colorsFor(resolved);
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const setHealthSyncEnabled = useSettingsStore((state) => state.setHealthSyncEnabled);
  const steps = useHealthSteps(day.date);
  const queryClient = useQueryClient();

  const activities = useActivities(day.date).data ?? [];
  const needsConnect = !healthSyncEnabled || steps.data === null;

  const connect = async () => {
    const granted = await getHealthProvider().requestPermissions();

    if (granted) {
      setHealthSyncEnabled(true);
      void queryClient.invalidateQueries({ queryKey: queryKeys.health.all });
    } else {
      Alert.alert(t('healthSync', 'heading'), t('healthSync', 'permissionDenied'), [
        { text: t('common', 'cancel'), style: 'cancel' },
        { text: t('healthSync', 'openSettings'), onPress: () => getHealthProvider().openSettings() },
      ]);
    }
  };

  return (
    <MetricSection
      title={t('dashboard', 'caloriesBurned')}
      value={energy.format(day.exerciseKcal)}
      onAdd={() => router.push('/log/activity')}
    >
      <View className="gap-3 pt-1">
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="caption" tone="muted">
              {t('dashboard', 'steps')}
            </Text>
            {needsConnect ? (
              <Pressable accessibilityRole="button" onPress={() => void connect()}>
                <Text variant="heading" tone="brand">
                  {t('dashboard', healthSyncEnabled ? 'reconnectHealth' : 'connectHealth')}
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
          {t('dashboard', 'burnGoal')
            .replace('{kcal}', String(energy.format(DASHBOARD_BURN_GOAL_KCAL)))
            .replace('{unit}', energy.unit)}
        </Text>
      </View>
    </MetricSection>
  );
}
