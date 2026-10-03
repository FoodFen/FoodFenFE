import { create } from 'zustand';

interface QuizState {
  quizId: string | null;
  answers: Record<string, string>;
  index: number;
  begin: (quizId: string) => void;
  select: (questionId: string, optionId: string) => void;
  next: () => void;
  back: () => void;
}

/**
 * In-progress answers for the quiz currently open. Re-entering the same quiz
 * (e.g. after a failed submit) keeps them; opening a different one starts clean.
 */
export const useQuizStore = create<QuizState>((set, get) => ({
  quizId: null,
  answers: {},
  index: 0,
  begin: (quizId) => {
    if (get().quizId !== quizId) set({ quizId, answers: {}, index: 0 });
  },
  select: (questionId, optionId) =>
    set((state) => ({ answers: { ...state.answers, [questionId]: optionId } })),
  next: () => set((state) => ({ index: state.index + 1 })),
  back: () => set((state) => ({ index: Math.max(0, state.index - 1) })),
}));
