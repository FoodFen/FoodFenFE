import { create } from 'zustand';

import * as userRepository from '@/data/userRepository';
import type { CreateUserInput } from '@/data/userRepository';
import { eraseDatabase } from '@/db/client';
import { useSettingsStore } from '@/features/settings/store';
import type { UserProfile } from '@/types/models';

/**
 * The local profile: who the app is tracking for, independent of any account.
 *
 * The root layout gates on this, not on being signed in — onboarding is the
 * only thing standing between a fresh install and a usable diary.
 * `useAuthStore` is orthogonal: it holds an optional session that only decides
 * whether reads try the server first.
 *
 * The store is a thin cache over the `user` table so screens re-render on
 * change; `src/data/userRepository.ts` owns the reads and writes.
 */
interface ProfileState {
  profile: UserProfile | null;
  /**
   * False until `refresh()` has run once. `profile === null` is ambiguous on
   * its own — it means both "not loaded yet" and "no profile, show
   * onboarding" — and routing on the second before the first has happened
   * would flash onboarding at an existing user on every cold start.
   */
  isLoaded: boolean;

  /**
   * Read the user row from the database.
   *
   * Must not run before migrations finish, which is why the initial state is
   * empty rather than a query: this store is constructed on import, and at
   * that point the tables do not exist yet. The root layout calls this once
   * `useDatabaseMigrations` reports success.
   */
  refresh: () => void;
  /** First run: create the local user and their opening daily goal. */
  createProfile: (input: CreateUserInput) => UserProfile;
  /**
   * Update body stats or preferences. Recomputes today's goal when the user is
   * in `auto` mode, since their targets are a function of these fields.
   */
  saveProfile: (patch: Partial<UserProfile>) => UserProfile;
  /** Delete every local record and return to a fresh, un-onboarded state. */
  eraseAll: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoaded: false,

  refresh: () => {
    set({ profile: userRepository.getLocalUser() ?? null, isLoaded: true });
  },

  createProfile: (input) => {
    const { user } = userRepository.createLocalUser(input);

    set({ profile: user });

    return user;
  },

  saveProfile: (patch) => {
    const current = get().profile;

    if (!current) {
      throw new Error('Cannot save profile fields before onboarding has run.');
    }

    const updated = userRepository.updateLocalUser(current.id, patch);

    userRepository.refreshGoalIfAuto(updated);
    set({ profile: updated });

    return updated;
  },

  eraseAll: () => {
    eraseDatabase();
    useSettingsStore.getState().resetOnboarding();
    // Still loaded — the tables exist and were just read as empty. Only the
    // profile is gone, which is exactly the state onboarding expects.
    set({ profile: null, isLoaded: true });
  },
}));

/** Premium gates the fiber breakdown and custom ingredient entry. */
export function useIsPremium(): boolean {
  return useProfileStore((state) => state.profile?.subscriptionTier === 'premium');
}
