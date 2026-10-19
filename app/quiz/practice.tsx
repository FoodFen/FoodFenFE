import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { QuizSignInPrompt } from '@/components/quiz/QuizSignInPrompt';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuizAvailable, useQuizTopics, useStartPractice } from '@/features/quiz/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';
import type { ThemeColors } from '@/theme/colors';

type TopicStyle = { icon: keyof typeof Ionicons.glyphMap; color: string };

const TOPIC_PATTERNS = [
  /protein|đạm|tinh bột|chất béo|carb/,
  /nước|chất xơ|water|fiber/,
  /thói quen|habit/,
  /vitamin|khoáng/,
];

function topicStyle(topic: { id: string; label: string }, index: number, colors: ThemeColors) {
  const palette: TopicStyle[] = [
    { icon: 'nutrition-outline', color: colors.carbs },
    { icon: 'water-outline', color: colors.fat },
    { icon: 'leaf-outline', color: colors.brand },
    { icon: 'medkit-outline', color: colors.protein },
  ];
  const key = `${topic.id} ${topic.label}`.toLowerCase();
  const match = TOPIC_PATTERNS.findIndex((re) => re.test(key));

  return palette[match >= 0 ? match : index % palette.length] as TopicStyle;
}

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
      {data.topics.map((topic, index) => {
        const { icon, color } = topicStyle(topic, index, colors);

        return (
          <Animated.View key={topic.id} entering={FadeInDown.delay(index * 50)}>
            <PressableScale
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
              <Card className="flex-row items-center gap-3">
                {/* ~15% alpha over the topic colour (0x26 / 255) */}
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${color}26` }}
                >
                  <Ionicons name={icon} size={20} color={color} />
                </View>
                <Text variant="label" className="flex-1">
                  {topic.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.fgSubtle} />
              </Card>
            </PressableScale>
          </Animated.View>
        );
      })}

      {start.isError ? (
        <Text variant="caption" tone="danger">
          {t('quiz', 'loadError')}
        </Text>
      ) : null}
    </ScrollScreen>
  );
}
