import { create } from 'zustand';

import type { Quest } from '@/types/models';

/**
 * The lightweight quest-progress toast (UC-22's second tier).
 *
 * Once every active quest type has already earned its one full-screen
 * interstitial, further progress shows this instead — a brief, in-app
 * banner rather than a takeover. Carries every quest that advanced from the
 * triggering action (throttled — see `usePostLogInterstitial`), capped at
 * `MAX_ENTRIES`, so one log that moves several quests at once shows them
 * together instead of a burst of separate toasts.
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
  show: (entries: QuestToastEntry[]) => void;
  hide: () => void;
}

export const useQuestToastStore = create<ToastState>((set) => ({
  entries: [],
  token: 0,
  show: (entries) =>
    set((state) => ({
      entries: entries.slice(0, MAX_TOAST_ENTRIES),
      token: state.token + 1,
    })),
  hide: () => set({ entries: [] }),
}));
