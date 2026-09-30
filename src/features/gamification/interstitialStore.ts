import { create } from 'zustand';

import type { Quest } from '@/types/models';

/**
 * The post-log challenge interstitial's open state (UC-22).
 *
 * Mirrors `useLogSheetStore`'s shape. The quests shown are whatever the
 * server returned from the background `pullQuests` call that led to
 * `present()`, so the screen itself never has to fetch or recompute — just
 * render what it was given.
 *
 * `leave` is how the *caller* gets back to where it started once the
 * interstitial's own Continue button is pressed. It has to travel with the
 * quests rather than be hardcoded in the screen: the interstitial is reached
 * from callers at different navigation depths — the routed `log/manual`,
 * `log/search` and `log/activity` screens need a `router.dismiss()` to close
 * the modal stack underneath them, while the always-mounted `LogSheet` and a
 * direct dashboard action (a water cup tap) never pushed anything and need no
 * navigation at all. See `usePostLogInterstitial` in `../gamification/queries`.
 */

interface InterstitialState {
  open: boolean;
  quests: Quest[];
  leave: () => void;
  present: (quests: Quest[], leave: () => void) => void;
  dismiss: () => void;
}

export const useInterstitialStore = create<InterstitialState>((set) => ({
  open: false,
  quests: [],
  leave: () => {},
  present: (quests, leave) => set({ open: true, quests, leave }),
  dismiss: () => set({ open: false, quests: [], leave: () => {} }),
}));
