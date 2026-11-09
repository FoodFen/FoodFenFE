import { create } from 'zustand';

import { StorageKeys, preferences } from '@/lib/storage';

/**
 * First-run feature tour state. `pending` is persisted and only ever set by
 * finishing the onboarding wizard or by Settings → Replay tour, so restored
 * and pre-existing users never see the tour.
 */

export type TourTargetId = 'logButton' | 'summary' | 'coins' | 'achievementsTab' | 'insightsTab';

export const TOUR_STEPS: readonly TourTargetId[] = [
  'logButton',
  'summary',
  'coins',
  'achievementsTab',
  'insightsTab',
];

export type TourRect = { x: number; y: number; width: number; height: number };

type TourState = {
  pending: boolean;
  active: boolean;
  step: number;
  rects: Partial<Record<TourTargetId, TourRect>>;
  queue: () => void;
  start: () => void;
  next: () => void;
  finish: () => void;
  setRect: (id: TourTargetId, rect: TourRect) => void;
};

export const useTourStore = create<TourState>((set, get) => ({
  pending: preferences.get<boolean>(StorageKeys.tourPending) === true,
  active: false,
  step: 0,
  rects: {},

  queue: () => {
    preferences.set(StorageKeys.tourPending, true);
    set({ pending: true });
  },

  start: () => {
    const { pending, active } = get();
    if (pending && !active) set({ active: true, step: 0 });
  },

  next: () => {
    const { step } = get();
    if (step >= TOUR_STEPS.length - 1) get().finish();
    else set({ step: step + 1 });
  },

  finish: () => {
    preferences.remove(StorageKeys.tourPending);
    set({ active: false, pending: false });
  },

  setRect: (id, rect) => {
    const prev = get().rects[id];
    if (
      prev &&
      prev.x === rect.x &&
      prev.y === rect.y &&
      prev.width === rect.width &&
      prev.height === rect.height
    ) {
      return;
    }
    set((state) => ({ rects: { ...state.rects, [id]: rect } }));
  },
}));
