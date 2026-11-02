import { create } from 'zustand';

import type { MascotImages } from '@/lib/mascot';
import { StorageKeys, preferences } from '@/lib/storage';

/**
 * Device cache of the account's equipped mascot. `pendingEquipId` is an equip
 * the server has not acknowledged yet; the next catalogue pull retries it.
 * Account state, so sign-out resets it.
 */

export const DEFAULT_MASCOT_ID = 'default';

interface Persisted {
  equippedId: string;
  pendingEquipId: string | null;
}

interface MascotEquipState extends Persisted {
  images: Record<string, MascotImages>;
  setImages: (images: Record<string, MascotImages>) => void;
  bodyColors: Record<string, string | null>;
  setBodyColors: (bodyColors: Record<string, string | null>) => void;
  equip: (id: string) => void;
  adopt: (id: string) => void;
  /** Clears the pending equip `id` (no-op if superseded), optionally adopting the server's id. */
  settle: (id: string, adoptId?: string) => void;
  reset: () => void;
}

function persist(next: Persisted): Persisted {
  preferences.set(StorageKeys.mascotEquippedId, next.equippedId);
  preferences.set(StorageKeys.mascotPendingEquipId, next.pendingEquipId);

  return next;
}

export const useMascotEquipStore = create<MascotEquipState>((set) => ({
  equippedId: preferences.get<string>(StorageKeys.mascotEquippedId) ?? DEFAULT_MASCOT_ID,
  pendingEquipId: preferences.get<string | null>(StorageKeys.mascotPendingEquipId) ?? null,

  images: preferences.get<Record<string, MascotImages>>(StorageKeys.mascotImages) ?? {},

  setImages: (images) => {
    preferences.set(StorageKeys.mascotImages, images);
    set({ images });
  },

  bodyColors: preferences.get<Record<string, string | null>>(StorageKeys.mascotBodyColors) ?? {},

  setBodyColors: (bodyColors) => {
    preferences.set(StorageKeys.mascotBodyColors, bodyColors);
    set({ bodyColors });
  },

  equip: (id) => set(persist({ equippedId: id, pendingEquipId: id })),

  adopt: (id) => set(persist({ equippedId: id, pendingEquipId: null })),

  settle: (id, adoptId) =>
    set((state) =>
      state.pendingEquipId === id
        ? persist({ equippedId: adoptId ?? state.equippedId, pendingEquipId: null })
        : state,
    ),

  reset: () => {
    preferences.set(StorageKeys.mascotImages, {});
    preferences.set(StorageKeys.mascotBodyColors, {});
    set({
      ...persist({ equippedId: DEFAULT_MASCOT_ID, pendingEquipId: null }),
      images: {},
      bodyColors: {},
    });
  },
}));
