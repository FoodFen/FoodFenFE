import { create } from 'zustand';

import type { Quest } from '@/types/models';

/**
 * The quest-progress toast (UC-22) — the only thing a background quest result
 * ever shows on its own; nothing navigates automatically.
 *
 * Carries the quests the triggering action moved (see `announceQuestChanges`
 * in `./queries`), capped at `MAX_TOAST_ENTRIES`, so one log that moves
 * several quests at once shows them together instead of a burst of separate
 * toasts. `onOpen` is set only the first time a quest type is announced: it
 * makes the toast tappable ("See more") and opens the full-screen explanation.
 *
 * `token` changes on every `show()` call (even for the same entries) so the
 * toast component can restart its animation/auto-hide timer for
 * back-to-back triggers.
 */

export interface QuestToastEntry {
  quest: Quest;
  completed: boolean;
}

export const MAX_TOAST_ENTRIES = 3;

interface ToastState {
  entries: QuestToastEntry[];
  token: number;
  onOpen: (() => void) | undefined;
  show: (entries: QuestToastEntry[], onOpen?: () => void) => void;
  hide: () => void;
}

export const useQuestToastStore = create<ToastState>((set) => ({
  entries: [],
  token: 0,
  onOpen: undefined,
  show: (entries, onOpen) =>
    set((state) => ({
      entries: entries.slice(0, MAX_TOAST_ENTRIES),
      token: state.token + 1,
      onOpen,
    })),
  hide: () => set({ entries: [], onOpen: undefined }),
}));
