import { useMemo } from 'react';
import { View } from 'react-native';

import { CalorieTrendChart } from '@/components/insights/CalorieTrendChart';
import { WeightTrendChart } from '@/components/insights/WeightTrendChart';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDiaryRange, useWeightHistory } from '@/features/diary/queries';
import { averageByMeal, summarizeTrends } from '@/features/insights/trends';
import { useProfileStore } from '@/features/profile/store';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { weightGoalDelta } from '@/lib/nutrition';
import { MEAL_TYPES } from '@/types/models';

const WINDOW_DAYS = 7;
const WEIGHT_WINDOW_DAYS = 90;

/**
 * Trends over the last week.
 *
 * Everything here is computed from the user's own diary. The AI insight layer
 * is not wired up yet; when it is, it should consume `summarizeTrends` output
 * rather than raw entries — see `src/features/insights/trends.ts`.
 */
export default function InsightsScreen() {
  const { t } = useTranslation();
  const { data, isPending, error, refetch } = useDiaryRange(WINDOW_DAYS);
  const weightHistory = useWeightHistory(WEIGHT_WINDOW_DAYS);
  const profile = useProfileStore((state) => state.profile);

  const summary = useMemo(() => (data ? summarizeTrends(data) : null), [data]);
  const perMeal = useMemo(() => (data ? averageByMeal(data) : null), [data]);

  if (isPending) {
    return (
      <ScrollScreen tabBar topInset>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </ScrollScreen>
    );
  }

  if (error) {
    return (
      <Screen tabBar topInset>
        <ErrorState
          description={
            error instanceof Error ? error.message : t('common', 'pleaseTryAgain')
          }
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  if (!summary || summary.daysLogged === 0) {
    return (
      <Screen tabBar topInset>
        <EmptyState
          icon="📊"
          title={t('insights', 'emptyTitle')}
          description={t('insights', 'emptyDescription')}
        />
      </Screen>
    );
  }

  const isDeficit = summary.averageDelta < 0;

  const weightSeries =
    weightHistory.data && weightHistory.data.length > 0
      ? weightHistory.data.map((log) => ({ date: log.recordedAt, weightKg: log.weight }))
      : profile
        ? [{ date: todayKey(), weightKg: profile.weightCurrent }]
        : [];

  const latestWeightKg = weightSeries[weightSeries.length - 1]?.weightKg;
  const weightDelta =
    profile && latestWeightKg !== undefined
      ? weightGoalDelta(latestWeightKg, profile.weightGoal)
      : null;

  return (
    <ScrollScreen tabBar topInset>
      <Text variant="title" className="pt-2">
        {t('insights', 'title')}
      </Text>

      <View className="flex-row gap-3">
        <StatCard
          label={t('insights', 'dailyAverage')}
          value={summary.averageKcal.toLocaleString()}
          unit="kcal"
        />
        <StatCard
          label={t('insights', 'loggingStreak')}
          value={String(summary.streak)}
          unit={t('insights', 'dayUnit')}
        />
      </View>

      <Card className="gap-4">
        <CardHeader>
          <Text variant="heading">
            {t('insights', 'windowHeading').replace('{days}', String(WINDOW_DAYS))}
          </Text>
          <Text variant="caption" tone="muted">
            {t('insights', 'daysLoggedOf')
              .replace('{logged}', String(summary.daysLogged))
              .replace('{total}', String(summary.totalDays))}
          </Text>
        </CardHeader>

        <CalorieTrendChart series={summary.series} />
      </Card>

      {profile ? (
        <Card className="gap-4">
          <CardHeader>
            <Text variant="heading">{t('insights', 'weightTrendHeading')}</Text>
          </CardHeader>

          {weightHistory.isPending ? (
            <Skeleton className="h-40 rounded-card" />
          ) : (
            <>
              <WeightTrendChart series={weightSeries} goalKg={profile.weightGoal} />
              {weightDelta ? (
                <Text variant="caption" tone="subtle">
                  {weightDelta.direction === 'atGoal'
                    ? t('dashboard', 'weightReached')
                    : t('dashboard', 'weightToGo').replace(
                        '{delta}',
                        String(Math.round(weightDelta.deltaKg * 10) / 10),
                      )}
                </Text>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      <Card className="gap-1">
        <Text variant="heading">{t('insights', 'againstGoalHeading')}</Text>
        <Text variant="title" tone={isDeficit ? 'brand' : 'danger'}>
          {isDeficit ? '−' : '+'}
          {Math.abs(summary.averageDelta).toLocaleString()} kcal
        </Text>
        <Text variant="body" tone="muted">
          {t('insights', isDeficit ? 'averageDeficit' : 'averageSurplus')}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('insights', 'averageMacrosHeading')}</Text>

        {(
          [
            ['proteinG', 'protein'],
            ['carbsG', 'carbs'],
            ['fatG', 'fat'],
          ] as const
        ).map(([macro, labelKey]) => (
          <View key={macro} className="flex-row items-center justify-between">
            <Text variant="body" tone="muted">
              {t('dashboard', labelKey)}
            </Text>
            <Text variant="mono">
              {summary.averageMacros[macro]} g ·{' '}
              {Math.round(summary.averageMacroShare[macro] * 100)}%
            </Text>
          </View>
        ))}
      </Card>

      {perMeal ? (
        <Card className="gap-3">
          <Text variant="heading">{t('insights', 'caloriesByMealHeading')}</Text>

          {MEAL_TYPES.map((meal) => (
            <View key={meal} className="flex-row items-center justify-between">
              <Text variant="body" tone="muted">
                {t('mealType', meal)}
              </Text>
              <Text variant="mono">{perMeal[meal].toLocaleString()} kcal</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollScreen>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <Card className="flex-1 gap-1">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View className="flex-row items-baseline gap-1">
        <Text variant="title">{value}</Text>
        <Text variant="caption" tone="subtle">
          {unit}
        </Text>
      </View>
    </Card>
  );
}
