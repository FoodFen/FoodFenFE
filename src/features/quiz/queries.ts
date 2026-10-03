import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { quizApi } from '@/api/endpoints/quiz';
import type { QuizSubmitAnswer } from '@/api/endpoints/quiz';
import { isApiError } from '@/api/errors';
import type { RemoteQuiz } from '@/api/schemas';
import { reconcileCoinBalance } from '@/data/gamificationRepository';
import { useAuthStore } from '@/features/auth/store';
import { useProfileStore } from '@/features/profile/store';
import type { DateKey } from '@/lib/date';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';

function useUserId(): string | null {
  return useProfileStore((state) => state.profile?.id ?? null);
}

export function useQuizAvailable(): boolean {
  const signedIn = useAuthStore((state) => state.session !== null);

  return signedIn && env.hasBackend;
}

/**
 * Today's daily quiz. Also seeds the by-id cache so opening it doesn't
 * refetch the questions it just returned.
 */
export function useDailyQuiz(date: DateKey) {
  const available = useQuizAvailable();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.quiz.daily(date),
    queryFn: async ({ signal }) => {
      const quiz = await quizApi.daily(date, signal);
      queryClient.setQueryData(queryKeys.quiz.byId(quiz.id), quiz);

      return quiz;
    },
    enabled: available,
    retry: false,
  });
}

/**
 * A completed quiz's `result.balance` is the server's *current* balance, so
 * reconciling it is always safe, and it is what fixes the header balance after
 * a 409 recovery (the submit response that carried it never reached us).
 */
export function useQuiz(id: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.quiz.byId(id),
    queryFn: async ({ signal }) => {
      const quiz = await quizApi.byId(id, signal);

      if (userId && quiz.result) {
        reconcileCoinBalance(userId, quiz.result.balance);
        void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.coins() });
      }

      return quiz;
    },
    retry: false,
  });
}

export function useQuizTopics() {
  const available = useQuizAvailable();

  return useQuery({
    queryKey: queryKeys.quiz.topics(),
    queryFn: ({ signal }) => quizApi.topics(signal),
    enabled: available,
    retry: false,
  });
}

export function useStartPractice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topic, date }: { topic: string; date: DateKey }) =>
      quizApi.startPractice(topic, date),
    onSuccess: (quiz) => {
      queryClient.setQueryData<RemoteQuiz>(queryKeys.quiz.byId(quiz.id), quiz);
    },
  });
}

/**
 * Grading and payout happen server-side in this one call; the local coin
 * ledger is only brought in line with the balance it returns. A 409 means the
 * quiz was already paid (double tap, or a retry whose first attempt landed),
 * so the stored result is re-read instead of surfacing an error.
 */
export function useSubmitQuiz() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, answers }: { quizId: string; answers: QuizSubmitAnswer[] }) =>
      quizApi.submit(quizId, answers),
    onSuccess: (result) => {
      if (userId) reconcileCoinBalance(userId, result.balance);

      queryClient.setQueryData<RemoteQuiz>(queryKeys.quiz.byId(result.quizId), (quiz) =>
        quiz ? { ...quiz, status: 'completed', result } : quiz,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.quiz.dailyAll() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.coins() });
    },
    onError: (error, { quizId }) => {
      if (isApiError(error) && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.quiz.byId(quizId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.quiz.dailyAll() });
      }
    },
  });
}
