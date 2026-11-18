import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isApiError } from '@/api/errors';
import type { RemoteQuiz, RemoteQuizResult } from '@/api/schemas';
import { Mascot } from '@/components/mascot/Mascot';
import { QuizSignInPrompt } from '@/components/quiz/QuizSignInPrompt';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, OfflineState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { SproutWash } from '@/components/ui/SproutWash';
import { Text } from '@/components/ui/Text';
import { useEquippedMascotId, useMascotBodyColor, useMascotImages } from '@/features/mascot/queries';
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
        <OfflineState description={t('quiz', 'needsConnection')} onRetry={refetch} />
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

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function QuizTake({ quiz }: { quiz: RemoteQuiz }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const mascotId = useEquippedMascotId();
  const images = useMascotImages(mascotId);
  const bodyColor = useMascotBodyColor(mascotId);
  const quizId = useQuizStore((state) => state.quizId);
  const storedAnswers = useQuizStore((state) => state.answers);
  const storedIndex = useQuizStore((state) => state.index);
  const begin = useQuizStore((state) => state.begin);
  const select = useQuizStore((state) => state.select);
  const next = useQuizStore((state) => state.next);
  const submit = useSubmitQuiz();
  const [offline, setOffline] = useState(false);

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
  const chosenId = answers[question.id];
  const revealed = chosenId !== undefined;
  const isCorrect = chosenId === question.correctOptionId;
  const correctSoFar = quiz.questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  // The server caps and pays coins; only promise a chip when the cap cannot cut this answer.
  const showCoins =
    isCorrect &&
    quiz.coinsPerCorrect > 0 &&
    (quiz.coinsRemainingToday === null ||
      correctSoFar * quiz.coinsPerCorrect <= quiz.coinsRemainingToday);

  const onSelect = (optionId: string) => {
    const correct = optionId === question.correctOptionId;

    if (correct) haptics.success();
    else haptics.error();
    AccessibilityInfo.announceForAccessibility(
      t('quiz', correct ? 'feedbackCorrect' : 'feedbackWrong'),
    );
    select(question.id, optionId);
  };

  const onSubmit = () => {
    if (!onlineManager.isOnline()) {
      setOffline(true);
      return;
    }

    setOffline(false);
    submit.mutate({
      quizId: quiz.id,
      answers: quiz.questions.flatMap((q) => {
        const optionId = answers[q.id];

        return optionId === undefined ? [] : [{ questionId: q.id, optionId }];
      }),
    });
  };

  const error = offline
    ? t('quiz', 'needsConnection')
    : submit.isError && !isAlreadySubmitted(submit.error)
      ? t('quiz', 'submitError')
      : null;

  return (
    <Screen>
      <ScrollScreen>
        <QuizProgress
          questions={quiz.questions}
          answers={answers}
          index={index}
          label={t('quiz', 'questionProgress')
            .replace('{current}', String(index + 1))
            .replace('{total}', String(total))}
        />

        {quiz.kind === 'practice' && quiz.coinsRemainingToday !== null ? (
          <Text variant="caption" tone="muted">
            {quiz.coinsRemainingToday === 0
              ? t('quiz', 'capReached')
              : t('quiz', 'capRemaining').replace('{coins}', String(quiz.coinsRemainingToday))}
          </Text>
        ) : null}

        <View className="flex-row items-end gap-2">
          <View className="h-[88px] w-[88px] items-center justify-center">
            <View className="absolute">
              <SproutWash size={88} />
            </View>
            <Mascot
              mascotId={mascotId}
              images={images}
              bodyColor={bodyColor}
              action={revealed ? (isCorrect ? 'happy' : 'sad') : 'idle'}
              size={80}
            />
          </View>
          <Animated.View
            key={question.id}
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            className="flex-1 rounded-card rounded-bl-[4px] border border-border bg-surface p-4"
          >
            <Text variant="heading">{question.text}</Text>
          </Animated.View>
        </View>

        <View className="gap-2">
          {question.options.map((option, optionIndex) => (
            <QuizOption
              key={option.id}
              letter={LETTERS[optionIndex] ?? ''}
              text={option.text}
              revealed={revealed}
              isCorrectOption={option.id === question.correctOptionId}
              chosen={option.id === chosenId}
              onPress={() => onSelect(option.id)}
            />
          ))}
        </View>
      </ScrollScreen>

      {revealed ? (
        <QuizFeedbackPanel
          key={question.id}
          correct={isCorrect}
          explanation={question.explanation}
          coins={showCoins ? quiz.coinsPerCorrect : null}
          error={error}
          bottomInset={insets.bottom}
          isLast={isLast}
          submitting={submit.isPending}
          onNext={next}
          onSubmit={onSubmit}
        />
      ) : null}
    </Screen>
  );
}

function QuizProgress({
  questions,
  answers,
  index,
  label,
}: {
  questions: RemoteQuiz['questions'];
  answers: Record<string, string>;
  index: number;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 flex-row gap-1">
        {questions.map((q, i) => {
          const answer = answers[q.id];

          return (
            <View
              key={q.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                answer !== undefined
                  ? answer === q.correctOptionId
                    ? 'bg-success'
                    : 'bg-danger'
                  : i === index
                    ? 'bg-fg-muted'
                    : 'bg-surface-alt',
              )}
            />
          );
        })}
      </View>
      <Text variant="caption" tone="muted" className="tabular-nums">
        {label}
      </Text>
    </View>
  );
}

function QuizOption({
  letter,
  text,
  revealed,
  isCorrectOption,
  chosen,
  onPress,
}: {
  letter: string;
  text: string;
  revealed: boolean;
  isCorrectOption: boolean;
  chosen: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));
  const wrongPick = revealed && chosen && !isCorrectOption;

  return (
    <Animated.View style={style}>
      <PressableScale
        haptic={false}
        disabled={revealed}
        accessibilityRole="button"
        accessibilityLabel={
          revealed
            ? `${letter}. ${text}, ${t('quiz', isCorrectOption ? 'feedbackCorrect' : 'feedbackWrong')}`
            : `${letter}. ${text}`
        }
        accessibilityState={{ selected: chosen, disabled: revealed }}
        onPress={() => {
          if (!reducedMotion) {
            if (isCorrectOption) scale.set(withSequence(withSpring(1.04), withSpring(1)));
            else
              shift.set(
                withSequence(
                  withTiming(-6, { duration: 50 }),
                  withTiming(6, { duration: 50 }),
                  withTiming(-4, { duration: 50 }),
                  withTiming(4, { duration: 50 }),
                  withTiming(0, { duration: 50 }),
                ),
              );
          }
          onPress();
        }}
        className={cn(
          'min-h-14 flex-row items-center gap-3 rounded-card border p-4',
          !revealed && 'border-border bg-surface',
          revealed && isCorrectOption && 'border-success bg-success/10',
          wrongPick && 'border-danger bg-danger/10',
          revealed && !isCorrectOption && !wrongPick && 'border-border bg-surface opacity-50',
        )}
      >
        <View className="h-7 w-7 items-center justify-center rounded-full bg-surface-alt">
          <Text variant="label">{letter}</Text>
        </View>
        <Text variant="body" className="flex-1">
          {text}
        </Text>
        {revealed && isCorrectOption ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        ) : null}
        {wrongPick ? <Ionicons name="close-circle" size={22} color={colors.danger} /> : null}
      </PressableScale>
    </Animated.View>
  );
}

function QuizFeedbackPanel({
  correct,
  explanation,
  coins,
  error,
  bottomInset,
  isLast,
  submitting,
  onNext,
  onSubmit,
}: {
  correct: boolean;
  explanation: string;
  coins: number | null;
  error: string | null;
  bottomInset: number;
  isLast: boolean;
  submitting: boolean;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(220)}
      className="gap-3 border-t border-border bg-surface px-4 pt-4"
      style={{ paddingBottom: bottomInset + 16 }}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={correct ? 'checkmark-circle' : 'close-circle'}
          size={22}
          color={correct ? colors.success : colors.danger}
        />
        <Text variant="heading" className="flex-1">
          {t('quiz', correct ? 'feedbackCorrect' : 'feedbackWrong')}
        </Text>
        {coins !== null ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="sparkles" size={16} color={colors.warning} />
            <Text variant="label" tone="brand">
              {t('quiz', 'coinsEarned').replace('{coins}', String(coins))}
            </Text>
          </View>
        ) : null}
      </View>

      {explanation === '' ? null : (
        <Text variant="body" tone="muted">
          {explanation}
        </Text>
      )}

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <Button
        label={t('quiz', isLast ? 'viewResult' : 'next')}
        loading={submitting}
        hapticFeedback={false}
        onPress={isLast ? onSubmit : onNext}
      />
    </Animated.View>
  );
}

function QuizResultView({ quiz, result }: { quiz: RemoteQuiz; result: RemoteQuizResult }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const mascotId = useEquippedMascotId();
  const images = useMascotImages(mascotId);
  const bodyColor = useMascotBodyColor(mascotId);
  const byQuestion = new Map(result.answers.map((answer) => [answer.questionId, answer]));
  const passed = result.correctCount * 2 >= result.total;
  const title =
    result.correctCount === result.total
      ? 'resultPerfect'
      : passed
        ? 'resultGood'
        : 'resultTryAgain';

  return (
    <ScrollScreen>
      <Card className="items-center gap-2">
        <View className="h-[140px] w-[140px] items-center justify-center">
          <View className="absolute">
            <SproutWash size={140} />
          </View>
          <Mascot
            mascotId={mascotId}
            images={images}
            bodyColor={bodyColor}
            action={passed ? 'happy' : 'idle'}
            size={120}
          />
        </View>
        <Text variant="title" className="text-center">
          {t('quiz', title)}
        </Text>
        <AnimatedNumber
          variant="display"
          value={result.correctCount}
          format={(value) => `${Math.round(value)}/${result.total}`}
        />
        <Text variant="caption" tone="muted">
          {t('quiz', 'resultCorrectCaption')}
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

      <Card flush className="overflow-hidden">
        {quiz.questions.map((question, i) => {
          const answer = byQuestion.get(question.id);
          const optionText = (optionId: string | undefined) =>
            question.options.find((option) => option.id === optionId)?.text ?? '';

          return (
            <View
              key={question.id}
              className={cn('flex-row gap-3 p-4', i > 0 && 'border-t border-border')}
            >
              {answer ? (
                <Ionicons
                  name={answer.correct ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={answer.correct ? colors.success : colors.danger}
                />
              ) : null}
              <View className="flex-1 gap-1">
                <Text variant="label">{question.text}</Text>
                {answer ? (
                  <>
                    {answer.correct ? null : (
                      <>
                        <Text variant="caption" tone="danger">
                          {t('quiz', 'yourAnswer')}: {optionText(answer.selectedOptionId)}
                        </Text>
                        <Text variant="caption" tone="success">
                          {t('quiz', 'correctAnswer')}: {optionText(answer.correctOptionId)}
                        </Text>
                      </>
                    )}
                    {answer.explanation === '' ? null : (
                      <Text variant="caption" tone="muted">
                        {answer.explanation}
                      </Text>
                    )}
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>

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
