import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isApiError } from '@/api/errors';
import { CalorieTrendChart } from '@/components/insights/CalorieTrendChart';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDiaryRange } from '@/features/diary/queries';
import { MEAL_LABELS } from '@/features/diary/selectors';
import { averageByMeal, summarizeTrends } from '@/features/insights/trends';
import { MEAL_TYPES } from '@/types/models';

const WINDOW_DAYS = 7;

/**
 * Trends over the last week.
 *
 * Everything here is computed from the user's own diary. The AI insight layer
 * is not wired up yet; when it is, it should consume `summarizeTrends` output
 * rather than raw entries — see `src/features/insights/trends.ts`.
 */
export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isPending, error, refetch } = useDiaryRange(WINDOW_DAYS);

  const summary = useMemo(() => (data ? summarizeTrends(data) : null), [data]);
  const perMeal = useMemo(() => (data ? averageByMeal(data) : null), [data]);

  if (isPending) {
    return (
      <ScrollScreen style={{ paddingTop: insets.top }}>
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
          description={isApiError(error) ? error.userMessage : 'Please try again.'}
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

  return (
    <ScrollScreen style={{ paddingTop: insets.top }}>
      <Text variant="title" className="pt-2">
        Insights
      </Text>

      <View className="flex-row gap-3">
        <StatCard
          label="Daily average"
          value={summary.averageCalories.toLocaleString()}
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

        {(['protein', 'carbs', 'fat'] as const).map((macro) => (
          <View key={macro} className="flex-row items-center justify-between">
            <Text variant="body" tone="muted" className="capitalize">
              {macro}
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
