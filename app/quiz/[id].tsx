import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { isApiError } from '@/api/errors';
import type { RemoteQuiz, RemoteQuizResult } from '@/api/schemas';
import { QuizSignInPrompt } from '@/components/quiz/QuizSignInPrompt';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useQuiz, useQuizAvailable, useSubmitQuiz } from '@/features/quiz/queries';
import { useQuizStore } from '@/features/quiz/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const available = useQuizAvailable();
  const { data: quiz, isPending, fetchStatus, error, refetch } = useQuiz(id);

  if (!available) return <QuizSignInPrompt />;

  if (isPending) {
    return fetchStatus === 'paused' ? (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title={t('quiz', 'needsConnection')} />
      </Screen>
    ) : (
      <ScrollScreen>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-14 rounded-card" />
        <Skeleton className="h-14 rounded-card" />
      </ScrollScreen>
    );
  }

  if (error || !quiz) {
    return (
      <Screen>
        <ErrorState description={t('quiz', 'loadError')} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  if (quiz.status === 'completed' && quiz.result) {
    return <QuizResultView quiz={quiz} result={quiz.result} />;
  }

  return <QuizTake quiz={quiz} />;
}

function isAlreadySubmitted(error: unknown): boolean {
  return isApiError(error) && error.status === 409;
}

function QuizTake({ quiz }: { quiz: RemoteQuiz }) {
  const { t } = useTranslation();
  const quizId = useQuizStore((state) => state.quizId);
  const storedAnswers = useQuizStore((state) => state.answers);
  const storedIndex = useQuizStore((state) => state.index);
  const begin = useQuizStore((state) => state.begin);
  const select = useQuizStore((state) => state.select);
  const next = useQuizStore((state) => state.next);
  const back = useQuizStore((state) => state.back);
  const submit = useSubmitQuiz();

  useEffect(() => {
    begin(quiz.id);
  }, [quiz.id, begin]);

  const isCurrent = quizId === quiz.id;
  const answers = isCurrent ? storedAnswers : {};
  const index = isCurrent ? storedIndex : 0;
  const total = quiz.questions.length;
  const question = quiz.questions[index];

  if (!question) return null;

  const isLast = index === total - 1;
  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  const onSubmit = () => {
    if (!onlineManager.isOnline()) {
      Alert.alert(t('quiz', 'needsConnection'));
      return;
    }

    submit.mutate(
      {
        quizId: quiz.id,
        answers: quiz.questions.flatMap((q) => {
          const optionId = answers[q.id];

          return optionId === undefined ? [] : [{ questionId: q.id, optionId }];
        }),
      },
      {
        onSuccess: () => haptics.success(),
        onError: (error) => {
          if (!isAlreadySubmitted(error)) haptics.error();
        },
      },
    );
  };

  return (
    <ScrollScreen>
      <Text variant="caption" tone="muted">
        {t('quiz', 'questionProgress')
          .replace('{current}', String(index + 1))
          .replace('{total}', String(total))}
      </Text>
      <ProgressBar progress={(index + 1) / total} />

      {quiz.kind === 'practice' && quiz.coinsRemainingToday !== null ? (
        <Text variant="caption" tone="muted">
          {quiz.coinsRemainingToday === 0
            ? t('quiz', 'capReached')
            : t('quiz', 'capRemaining').replace('{coins}', String(quiz.coinsRemainingToday))}
        </Text>
      ) : null}

      <Text variant="heading">{question.text}</Text>

      <View className="gap-2">
        {question.options.map((option) => {
          const selected = answers[question.id] === option.id;

          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.selection();
                select(question.id, option.id);
              }}
              className={cn(
                'rounded-card border p-4',
                selected ? 'border-brand bg-brand/10' : 'border-border bg-surface',
              )}
            >
              <Text variant="body">{option.text}</Text>
            </Pressable>
          );
        })}
      </View>

      {submit.isError && !isAlreadySubmitted(submit.error) ? (
        <Text variant="caption" tone="danger">
          {t('quiz', 'submitError')}
        </Text>
      ) : null}

      <View className="flex-row gap-3">
        {index > 0 ? (
          <Button
            label={t('quiz', 'back')}
            variant="secondary"
            className="flex-1"
            onPress={back}
          />
        ) : null}
        {isLast ? (
          <Button
            label={t('quiz', 'submit')}
            className="flex-1"
            disabled={!allAnswered}
            loading={submit.isPending}
            onPress={onSubmit}
          />
        ) : (
          <Button
            label={t('quiz', 'next')}
            className="flex-1"
            disabled={answers[question.id] === undefined}
            onPress={next}
          />
        )}
      </View>
    </ScrollScreen>
  );
}

function QuizResultView({ quiz, result }: { quiz: RemoteQuiz; result: RemoteQuizResult }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const byQuestion = new Map(result.answers.map((answer) => [answer.questionId, answer]));

  return (
    <ScrollScreen>
      <Card className="items-center gap-2">
        <Text variant="display">
          {t('quiz', 'resultScore')
            .replace('{correct}', String(result.correctCount))
            .replace('{total}', String(result.total))}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="sparkles" size={18} color={colors.warning} />
          <Text variant="heading" tone="brand">
            {t('quiz', 'coinsEarned').replace('{coins}', String(result.coinsEarned))}
          </Text>
        </View>
        {result.coinsRemainingToday === null ? null : (
          <Text variant="caption" tone="muted">
            {result.coinsRemainingToday === 0
              ? t('quiz', 'capReached')
              : t('quiz', 'capRemaining').replace('{coins}', String(result.coinsRemainingToday))}
          </Text>
        )}
      </Card>

      {quiz.questions.map((question) => {
        const answer = byQuestion.get(question.id);
        const optionText = (optionId: string | undefined) =>
          question.options.find((option) => option.id === optionId)?.text ?? '';

        return (
          <Card key={question.id} className="gap-2">
            <Text variant="label">{question.text}</Text>
            {answer ? (
              <>
                <Text variant="body" tone={answer.correct ? 'success' : 'danger'}>
                  {t('quiz', 'yourAnswer')}: {optionText(answer.selectedOptionId)}
                </Text>
                {answer.correct ? null : (
                  <Text variant="body" tone="success">
                    {t('quiz', 'correctAnswer')}: {optionText(answer.correctOptionId)}
                  </Text>
                )}
                <Text variant="caption" tone="muted">
                  {answer.explanation}
                </Text>
              </>
            ) : null}
          </Card>
        );
      })}

      <Button label={t('quiz', 'done')} onPress={() => router.back()} />
      {quiz.kind === 'practice' ? (
        <Button
          label={t('quiz', 'practiceAgain')}
          variant="secondary"
          onPress={() => router.replace('/quiz/practice')}
        />
      ) : null}
    </ScrollScreen>
  );
}
