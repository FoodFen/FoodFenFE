import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useActiveQuests } from '@/features/gamification/queries';
import { questDescription, questTitle } from '@/features/gamification/selectors';
import { useTranslation } from '@/hooks/useTranslation';
import { calendarWeek, daysUntil, todayKey } from '@/lib/date';
import { progressFraction } from '@/lib/nutrition';
import type { Quest } from '@/types/models';

/**
 * The Daily/Weekly challenges screen (UC-23).
 *
 * `useActiveQuests` already recomputes live progress on every read (the same
 * query-time-aggregation pattern as the diary), so this screen never shows a
 * number staler than whatever was last logged.
 */
export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { data: quests, isPending, error, refetch } = useActiveQuests();

  if (isPending) {
    return (
      <ScrollScreen bottomSpacing={96} style={{ paddingTop: insets.top }}>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
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

  if (!quests || quests.length === 0) {
    return (
      <View style={{ paddingTop: insets.top }} className="flex-1 bg-bg">
        <Text variant="title" className="px-4 pt-2">
          {t('achievements', 'title')}
        </Text>
        <EmptyState
          icon="🏅"
          title={t('achievements', 'emptyTitle')}
          description={t('achievements', 'emptyDescription')}
        />
      </View>
    );
  }

  const daily = quests.filter((q) => q.cadence === 'daily');
  const weekly = quests.filter((q) => q.cadence === 'weekly');
  const weekEnd = calendarWeek(todayKey())[6] ?? todayKey();

  return (
    <ScrollScreen bottomSpacing={96} style={{ paddingTop: insets.top }}>
      <Text variant="title" className="pt-2">
        {t('achievements', 'title')}
      </Text>

      {daily.length > 0 ? (
        <View className="gap-3">
          <Text variant="heading">{t('achievements', 'dailyHeading')}</Text>
          {daily.map((quest) => (
            <ChallengeRow key={quest.id} quest={quest} daysLeft={0} />
          ))}
        </View>
      ) : null}

      {weekly.length > 0 ? (
        <View className="gap-3">
          <Text variant="heading">{t('achievements', 'weeklyHeading')}</Text>
          {weekly.map((quest) => (
            <ChallengeRow
              key={quest.id}
              quest={quest}
              daysLeft={Math.max(daysUntil(weekEnd), 0)}
            />
          ))}
        </View>
      ) : null}
    </ScrollScreen>
  );
}

function ChallengeRow({ quest, daysLeft }: { quest: Quest; daysLeft: number }) {
  const { t } = useTranslation();

  return (
    <Card className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text variant="heading">{questTitle(t, quest.questType)}</Text>
        <Text variant="caption" tone="brand">
          +{quest.rewardCoins}
        </Text>
      </View>
      <Text variant="body" tone="muted">
        {questDescription(t, quest)}
      </Text>
      <ProgressBar progress={progressFraction(quest.progress, quest.target)} />
      <View className="flex-row items-center justify-between">
        <Text variant="caption" tone="subtle">
          {quest.progress}/{quest.target}
        </Text>
        <Text variant="caption" tone="subtle">
          {daysLeft <= 0
            ? t('achievements', 'todayLeft')
            : t('achievements', 'daysLeft').replace('{days}', String(daysLeft))}
        </Text>
      </View>
    </Card>
  );
}
