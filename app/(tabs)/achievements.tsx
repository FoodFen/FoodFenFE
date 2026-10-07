import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { QuizCard } from '@/components/quiz/QuizCard';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import {
  useActiveQuests,
  useQuestsPull,
  useRefreshQuests,
  useStreak,
} from '@/features/gamification/queries';
import { questProgressFraction, questProgressLabel } from '@/features/gamification/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { calendarWeek, daysUntil, todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';
import type { Quest } from '@/types/models';

/**
 * The Daily/Weekly challenges screen (UC-23).
 *
 * `useActiveQuests` reads the on-device cache of the server's quests;
 * `useQuestsPull` refreshes that cache in the background.
 */
export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { data: quests, isPending, error, refetch } = useActiveQuests();
  const { data: streak } = useStreak();
  const sync = useQuestsPull();
  const refreshQuests = useRefreshQuests();
  const signedIn = useAuthStore((state) => state.session !== null);
  const { resolved } = useAppTheme();
  const [pulling, setPulling] = useState(false);
  const noQuests = !quests || quests.length === 0;
  const refreshControl = (
    <RefreshControl
      refreshing={pulling}
      onRefresh={() => {
        setPulling(true);
        void refreshQuests().finally(() => setPulling(false));
      }}
      tintColor={colorsFor(resolved).fgMuted}
    />
  );

  const weekEnd = calendarWeek(todayKey())[6] ?? todayKey();
  const daily = quests?.filter((q) => q.cadence === 'daily') ?? [];
  const weekly = quests?.filter((q) => q.cadence === 'weekly') ?? [];

  let questSection: ReactNode;

  if (isPending || (noQuests && sync.fetchStatus === 'fetching')) {
    questSection = (
      <>
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </>
    );
  } else if (error) {
    questSection = (
      <ErrorState
        description={error instanceof Error ? error.message : t('common', 'pleaseTryAgain')}
        onRetry={() => void refetch()}
      />
    );
  } else if (noQuests && !signedIn) {
    questSection = (
      <EmptyState
        icon="🔒"
        title={t('achievements', 'signInTitle')}
        description={t('achievements', 'signInDescription')}
        actionLabel={t('achievements', 'signIn')}
        onAction={() => router.push('/sign-in')}
      />
    );
  } else if (noQuests && sync.isError) {
    questSection = (
      <ErrorState
        description={t('achievements', 'emptyDescription')}
        onRetry={() => void refreshQuests()}
      />
    );
  } else if (noQuests) {
    questSection = (
      <EmptyState
        icon="🏅"
        title={t('achievements', 'emptyTitle')}
        description={t('achievements', 'emptyDescription')}
        actionLabel={t('common', 'retry')}
        onAction={() => void refreshQuests()}
      />
    );
  } else {
    questSection = (
      <>
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
      </>
    );
  }

  return (
    <ScrollScreen tabBar topInset refreshControl={refreshControl}>
      <Text variant="title" className="pt-2">
        {t('achievements', 'title')}
      </Text>

      <StreakSummaryCard currentStreak={streak?.currentStreak ?? 0} />
      <QuizCard />

      {questSection}
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
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <Card className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          {quest.completed ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
          ) : null}
          <Text variant="heading" numberOfLines={1} className="flex-1">
            {quest.title}
          </Text>
        </View>
        <Text variant="caption" tone="brand">
          +{quest.rewardCoins}
        </Text>
      </View>
      <Text variant="body" tone="muted">
        {quest.description}
      </Text>
      <ProgressBar
        progress={questProgressFraction(quest)}
        color={quest.completed ? colors.brand : undefined}
      />
      <View className="flex-row items-center justify-between">
        <Text variant="caption" tone="subtle">
          {questProgressLabel(quest)}
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
