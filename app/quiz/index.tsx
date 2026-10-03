import { router } from 'expo-router';
import { View } from 'react-native';

import { isApiError } from '@/api/errors';
import { QuizSignInPrompt } from '@/components/quiz/QuizSignInPrompt';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDailyQuiz, useQuizAvailable } from '@/features/quiz/queries';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';

export default function QuizHubScreen() {
  const { t } = useTranslation();
  const available = useQuizAvailable();
  const { data: daily, isPending, fetchStatus, error, refetch } = useDailyQuiz(todayKey());

  if (!available) return <QuizSignInPrompt />;

  return (
    <ScrollScreen>
      <Card className="gap-3">
        <Text variant="heading">{t('quiz', 'dailyHeading')}</Text>

        {daily ? (
          <>
            <Text variant="body" tone="muted">
              {daily.status === 'completed'
                ? t('quiz', 'cardDone')
                : t('quiz', 'cardPerCorrect').replace('{coins}', String(daily.coinsPerCorrect))}
            </Text>
            <Button
              label={
                daily.status === 'completed' ? t('quiz', 'viewResult') : t('quiz', 'startDaily')
              }
              onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: daily.id } })}
            />
          </>
        ) : isPending && fetchStatus === 'paused' ? (
          <Text variant="body" tone="muted">
            {t('quiz', 'needsConnection')}
          </Text>
        ) : isPending ? (
          <View className="gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-12 rounded-card" />
          </View>
        ) : (
          <>
            <Text variant="body" tone="danger">
              {isApiError(error) ? error.userMessage : t('quiz', 'loadError')}
            </Text>
            <Button
              label={t('common', 'retry')}
              variant="secondary"
              onPress={() => void refetch()}
            />
          </>
        )}
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('quiz', 'practiceHeading')}</Text>
        <Text variant="body" tone="muted">
          {t('quiz', 'practiceDescription')}
        </Text>
        <Button
          label={t('quiz', 'practiceButton')}
          variant="secondary"
          onPress={() => router.push('/quiz/practice')}
        />
      </Card>
    </ScrollScreen>
  );
}
