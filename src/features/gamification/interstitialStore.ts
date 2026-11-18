import { create } from 'zustand';

import type { Quest } from '@/types/models';

/**
 * The challenge interstitial's open state (UC-22).
 *
 * Mirrors `useLogSheetStore`'s shape. Only opened by the user tapping "See
 * more" on the quest toast (see `announceQuestChanges` in `./queries`), which
 * hands over the quests the toast was announcing — the screen itself never has
 * to fetch or recompute, just render what it was given.
  */

interface InterstitialState {
  open: boolean;
  quests: Quest[];
  present: (quests: Quest[]) => void;
  dismiss: () => void;
}

export const useInterstitialStore = create<InterstitialState>((set) => ({
  open: false,
  quests: [],
  present: (quests) => set({ open: true, quests }),
  dismiss: () => set({ open: false, quests: [] }),
}));
