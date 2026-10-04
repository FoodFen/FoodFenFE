import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { QuizCard } from '@/components/quiz/QuizCard';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useActiveQuests, useStreak } from '@/features/gamification/queries';
import { questDescription, questTitle } from '@/features/gamification/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { calendarWeek, daysUntil, todayKey } from '@/lib/date';
import { progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { Quest } from '@/types/models';

/**
 * The Daily/Weekly challenges screen (UC-23).
 *
 * `useActiveQuests` already recomputes live progress on every read (the same
 * query-time-aggregation pattern as the diary), so this screen never shows a
 * number staler than whatever was last logged.
 */
export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { data: quests, isPending, error, refetch } = useActiveQuests();
  const { data: streak } = useStreak();

  if (isPending) {
    return (
      <ScrollScreen tabBar topInset>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
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

  if (!quests || quests.length === 0) {
    return (
      <Screen tabBar topInset>
        <Text variant="title" className="px-4 pt-2">
          {t('achievements', 'title')}
        </Text>
        <EmptyState
          icon="🏅"
          title={t('achievements', 'emptyTitle')}
          description={t('achievements', 'emptyDescription')}
        />
      </Screen>
    );
  }

  const daily = quests.filter((q) => q.cadence === 'daily');
  const weekly = quests.filter((q) => q.cadence === 'weekly');
  const weekEnd = calendarWeek(todayKey())[6] ?? todayKey();

  return (
    <ScrollScreen tabBar topInset>
      <Text variant="title" className="pt-2">
        {t('achievements', 'title')}
      </Text>

      <StreakSummaryCard currentStreak={streak?.currentStreak ?? 0} />
      <QuizCard />

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

/** Links to the streak detail screen (UC-24b's day-streak screen). */
function StreakSummaryCard({ currentStreak }: { currentStreak: number }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <Pressable
      onPress={() => router.push('/streak')}
      accessibilityRole="button"
      accessibilityLabel={t('streak', 'viewStreak')}
      className="active:opacity-70"
    >
      <Card className="flex-row items-center gap-3">
        <Ionicons name="flame" size={22} color={colors.warning} />
        <View className="flex-1">
          <Text variant="label">
            {currentStreak} {t('streak', 'days')}
          </Text>
          <Text variant="caption" tone="muted">
            {t('streak', 'currentStreak')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.fgSubtle} />
      </Card>
    </Pressable>
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
