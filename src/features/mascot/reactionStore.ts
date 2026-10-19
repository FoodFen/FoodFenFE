import { create } from 'zustand';

import type { MascotReaction } from '@/lib/mascot';

export const REACTION_TTL_MS = 2 * 60_000;

interface PendingReaction {
  kind: MascotReaction;
  at: number;
}

interface MascotReactionState {
  pending: PendingReaction | null;
  queue: (kind: MascotReaction) => void;
  clear: () => void;
}

export const useMascotReactionStore = create<MascotReactionState>((set) => ({
  pending: null,
  queue: (kind) => set({ pending: { kind, at: Date.now() } }),
  clear: () => set({ pending: null }),
}));

/** The pending reaction, or `null` once it is older than the TTL. */
export function freshReaction(
  pending: PendingReaction | null,
  now: number = Date.now(),
): PendingReaction | null {
  return pending !== null && now - pending.at <= REACTION_TTL_MS ? pending : null;
}
