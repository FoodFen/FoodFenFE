import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import * as gamification from '@/data/gamificationRepository';
import * as userRepository from '@/data/userRepository';
import type { CreateUserInput } from '@/data/userRepository';
import { eraseDatabase } from '@/db/client';
import { useSettingsStore } from '@/features/settings/store';
import { cancelAll } from '@/lib/notificationScheduler';
import { queryKeys } from '@/lib/queryClient';
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
    // The erased diary/streak this device knew about is gone — any reminder
    // already scheduled would otherwise nudge about data that no longer
    // exists, so both settings go back to off and every pending
    // notification is cancelled, same as a fresh install.
    useSettingsStore.getState().setMealRemindersEnabled(false);
    useSettingsStore.getState().setStreakRemindersEnabled(false);
    void cancelAll();
    // Still loaded — the tables exist and were just read as empty. Only the
    // profile is gone, which is exactly the state onboarding expects.
    set({ profile: null, isLoaded: true });
  },
}));

/**
 * Premium gates the fiber breakdown and custom ingredient entry.
 *
 * Derived from `gamification.resolveTier`, not `profile.subscriptionTier`
 * directly — that flag is the server's copy (mirrored here for when an
 * account and push sync exist), while the local `subscription` table is
 * what an on-device purchase actually writes, and the only thing that knows
 * a plan has expired.
 *
 * Goes through `useQuery` rather than reading `resolveTier()` straight in a
 * Zustand selector: `startSubscription()` writes to SQLite directly, so
 * Zustand has no `set()` call to notify subscribers with, and a screen
 * already on-screen when a purchase completes would otherwise keep showing
 * its last-rendered tier forever. `useRefreshSubscription`'s
 * `invalidateQueries` on `queryKeys.premium.all` is what actually makes a
 * completed purchase show up — the same pattern `useStreak`/`useActiveQuests`
 * already use for "a local read that must refresh after a write elsewhere."
 */
export function useIsPremium(): boolean {
  const userId = useProfileStore((state) => state.profile?.id ?? null);

  const { data } = useQuery({
    queryKey: queryKeys.premium.tier(),
    queryFn: () => gamification.resolveTier(userId as string),
    enabled: userId !== null,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return data === 'premium';
}
