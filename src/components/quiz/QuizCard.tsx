import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useDailyQuiz, useQuizAvailable } from '@/features/quiz/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

/**
 * Entry to the quiz hub, shared by the Dashboard and Achievements. Renders
 * from whatever the daily-quiz query has cached and never waits on it; hidden
 * entirely when there is no account to pay coins into.
 */
export function QuizCard() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const available = useQuizAvailable();
  const { data: daily } = useDailyQuiz(todayKey());

  if (!available) return null;

  const subtitle =
    daily?.status === 'completed'
      ? t('quiz', 'cardDone')
      : daily
        ? t('quiz', 'cardPerCorrect').replace('{coins}', String(daily.coinsPerCorrect))
        : t('quiz', 'cardCta');

  return (
    <Pressable
      onPress={() => router.push('/quiz')}
      accessibilityRole="button"
      accessibilityLabel={t('quiz', 'cardTitle')}
    >
      <Card className="flex-row items-center gap-3 active:bg-surface-alt">
        <Ionicons name="school" size={22} color={colors.brand} />
        <View className="flex-1">
          <Text variant="label">{t('quiz', 'cardTitle')}</Text>
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.fgSubtle} />
      </Card>
    </Pressable>
  );
}
