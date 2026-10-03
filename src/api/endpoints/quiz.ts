import { api } from '@/api/client';
import { quizResultSchema, quizSchema, quizTopicsResponseSchema } from '@/api/schemas';
import type { RemoteQuiz, RemoteQuizResult } from '@/api/schemas';
import type { DateKey } from '@/lib/date';

export interface QuizSubmitAnswer {
  questionId: string;
  optionId: string;
}

/**
 * Server-graded quizzes — `docs/backend-contracts/quiz.md`. Correct answers
 * only ever arrive in `submit`'s response; the client never reports a score.
 */
export const quizApi = {
  topics: (signal?: AbortSignal) =>
    api.get('quizzes/topics', { schema: quizTopicsResponseSchema, signal }),

  daily: (date: DateKey, signal?: AbortSignal): Promise<RemoteQuiz> =>
    api.get('quizzes/daily', { query: { date }, schema: quizSchema, signal }),

  startPractice: (topic: string, date: DateKey): Promise<RemoteQuiz> =>
    api.post('quizzes/practice', { topic, date }, { schema: quizSchema }),

  byId: (id: string, signal?: AbortSignal): Promise<RemoteQuiz> =>
    api.get(`quizzes/${encodeURIComponent(id)}`, { schema: quizSchema, signal }),

  /** 409 `quiz_already_submitted` when this quiz was already paid. */
  submit: (quizId: string, answers: QuizSubmitAnswer[]): Promise<RemoteQuizResult> =>
    api.post(
      `quizzes/${encodeURIComponent(quizId)}/submit`,
      { answers },
      { schema: quizResultSchema },
    ),
};
