import { create } from 'zustand';

import type { Quest } from '@/types/models';

/**
 * The post-log challenge interstitial's open state (UC-22).
 *
 * Mirrors `useLogSheetStore`'s shape. The quests shown are computed once by
 * `evaluateQuestProgress` right before `present()` is called, so the screen
 * itself never has to fetch or recompute — just render what it was given.
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
