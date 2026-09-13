import { create } from 'zustand';

/**
 * The log bottom sheet's open state.
 *
 * Ephemeral UI state, so it lives in a store rather than the database: which
 * panel the sheet shows and whether it is open is a property of this session,
 * not of the user. Follows the pattern of `src/features/diary/draftStore.ts`.
 * The sheet itself does the real work through the diary mutation hooks.
 */

export type LogAction = 'weight' | 'water' | 'food' | 'waterGoal';

interface LogSheetState {
  open: boolean;
  /** The visible panel; `null` shows the action menu. */
  focus: LogAction | null;
  present: (focus?: LogAction) => void;
  /** Switch panels while the sheet stays open (the in-sheet menu rows). */
  setFocus: (focus: LogAction | null) => void;
  dismiss: () => void;
}

export const useLogSheetStore = create<LogSheetState>((set) => ({
  open: false,
  focus: null,
  present: (focus) => set({ open: true, focus: focus ?? null }),
  setFocus: (focus) => set({ focus }),
  dismiss: () => set({ open: false, focus: null }),
}));
