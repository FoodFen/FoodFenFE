import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalorieTrendChart } from '@/components/insights/CalorieTrendChart';
import { WeightTrendChart } from '@/components/insights/WeightTrendChart';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDiaryRange, useWeightHistory } from '@/features/diary/queries';
import { MEAL_LABELS } from '@/features/diary/selectors';
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
  const insets = useSafeAreaInsets();
  const { data, isPending, error, refetch } = useDiaryRange(WINDOW_DAYS);
  const weightHistory = useWeightHistory(WEIGHT_WINDOW_DAYS);
  const profile = useProfileStore((state) => state.profile);

  const summary = useMemo(() => (data ? summarizeTrends(data) : null), [data]);
  const perMeal = useMemo(() => (data ? averageByMeal(data) : null), [data]);

  if (isPending) {
    return (
      <ScrollScreen bottomSpacing={96} style={{ paddingTop: insets.top }}>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </ScrollScreen>
    );
  }

  if (error) {
    return (
      <View style={{ paddingTop: insets.top }} className="flex-1 bg-bg">
        <ErrorState
          description={error instanceof Error ? error.message : 'Please try again.'}
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  if (!summary || summary.daysLogged === 0) {
    return (
      <View style={{ paddingTop: insets.top }} className="flex-1 bg-bg">
        <EmptyState
          icon="📊"
          title="Nothing to chart yet"
          description="Log a few days of meals and your trends will show up here."
        />
      </View>
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
    <ScrollScreen bottomSpacing={96} style={{ paddingTop: insets.top }}>
      <Text variant="title" className="pt-2">
        Insights
      </Text>

      <View className="flex-row gap-3">
        <StatCard
          label="Daily average"
          value={summary.averageKcal.toLocaleString()}
          unit="kcal"
        />
        <StatCard
          label="Logging streak"
          value={String(summary.streak)}
          unit={summary.streak === 1 ? 'day' : 'days'}
        />
      </View>

      <Card className="gap-4">
        <CardHeader>
          <Text variant="heading">Last {WINDOW_DAYS} days</Text>
          <Text variant="caption" tone="muted">
            {summary.daysLogged} of {summary.totalDays} logged
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

      <Card className="gap-3">
        <Text variant="heading">Against your goal</Text>
        <Text variant="body" tone="muted">
          You averaged{' '}
          <Text variant="body" tone={isDeficit ? 'brand' : 'danger'}>
            {Math.abs(summary.averageDelta).toLocaleString()} kcal{' '}
            {isDeficit ? 'under' : 'over'}
          </Text>{' '}
          your daily target across the days you logged.
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">Average macros</Text>

        {(
          [
            ['proteinG', 'Protein'],
            ['carbsG', 'Carbs'],
            ['fatG', 'Fat'],
          ] as const
        ).map(([macro, label]) => (
          <View key={macro} className="flex-row items-center justify-between">
            <Text variant="body" tone="muted">
              {label}
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
          <Text variant="heading">Calories by meal</Text>

          {MEAL_TYPES.map((meal) => (
            <View key={meal} className="flex-row items-center justify-between">
              <Text variant="body" tone="muted">
                {MEAL_LABELS[meal]}
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
