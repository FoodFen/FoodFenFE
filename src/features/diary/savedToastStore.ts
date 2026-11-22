import { create } from 'zustand';

/**
 * The "added to your diary" confirmation toast shown after a food save.
 *
 * `token` changes on every `show()` call so `SavedToast` restarts its
 * auto-hide timer for back-to-back saves.
 */

interface SavedToastState {
  message: string | null;
  token: number;
  show: (message: string) => void;
  hide: () => void;
}

export const useSavedToastStore = create<SavedToastState>((set) => ({
  message: null,
  token: 0,
  show: (message) => set((state) => ({ message, token: state.token + 1 })),
  hide: () => set({ message: null }),
}));
