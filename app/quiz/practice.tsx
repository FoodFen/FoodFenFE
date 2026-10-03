import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, Pressable } from 'react-native';

import { QuizSignInPrompt } from '@/components/quiz/QuizSignInPrompt';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuizAvailable, useQuizTopics, useStartPractice } from '@/features/quiz/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

export default function PracticeTopicsScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const available = useQuizAvailable();
  const { data, isPending, fetchStatus, error, refetch } = useQuizTopics();
  const start = useStartPractice();

  if (!available) return <QuizSignInPrompt />;

  if (isPending) {
    return (
      <ScrollScreen>
        {fetchStatus === 'paused' ? (
          <Text variant="body" tone="muted">
            {t('quiz', 'needsConnection')}
          </Text>
        ) : (
          <>
            <Skeleton className="h-14 rounded-card" />
            <Skeleton className="h-14 rounded-card" />
          </>
        )}
      </ScrollScreen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <ErrorState description={t('quiz', 'loadError')} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  return (
    <ScrollScreen>
      {data.topics.map((topic) => (
        <Pressable
          key={topic.id}
          disabled={start.isPending}
          accessibilityRole="button"
          onPress={() => {
            if (!onlineManager.isOnline()) {
              Alert.alert(t('quiz', 'needsConnection'));
              return;
            }

            start.mutate(
              { topic: topic.id, date: todayKey() },
              {
                onSuccess: (quiz) =>
                  router.replace({ pathname: '/quiz/[id]', params: { id: quiz.id } }),
              },
            );
          }}
        >
          <Card className="flex-row items-center justify-between active:bg-surface-alt">
            <Text variant="label">{topic.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.fgSubtle} />
          </Card>
        </Pressable>
      ))}

      {start.isError ? (
        <Text variant="caption" tone="danger">
          {t('quiz', 'loadError')}
        </Text>
      ) : null}
    </ScrollScreen>
  );
}
