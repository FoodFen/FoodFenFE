import { createMMKV } from 'react-native-mmkv';

/**
 * Synchronous key-value storage.
 *
 * Three separate instances, so clearing one never touches the others:
 *   - `preferences` — device settings (theme, units). Survives sign-out.
 *   - `localData`   — the diary, the food catalog, the local profile. This is
 *     the source of truth while there is no backend, and it is NOT cleared on
 *     sign-out: a guest's diary is not account data, and signing in later
 *     should not delete it. Only an explicit "erase local data" action clears
 *     this store.
 *   - `cache`       — the persisted TanStack Query cache. Safe to wipe any
 *     time; everything in it is derived from `localData` (or, once sync
 *     exists, the server) and will be recomputed.
 *
 * MMKV is a native module built on Nitro: it is unavailable in Expo Go and in
 * Jest, so the accessors below degrade to an in-memory map rather than
 * throwing at import time.
 */

type Store = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  clearAll(): void;
};

function createStore(id: string): Store {
  try {
    const mmkv = createMMKV({ id });

    // Wrapped rather than returned directly: the Nitro object exposes far more
    // than this module needs, and narrowing it here keeps the fallback below
    // honest about what has to be implemented.
    return {
      getString: (key) => mmkv.getString(key),
      set: (key, value) => mmkv.set(key, value),
      remove: (key) => void mmkv.remove(key),
      clearAll: () => mmkv.clearAll(),
    };
  } catch {
    // Test environment, or a runtime without the native module linked.
    const memory = new Map<string, string>();

    return {
      getString: (key) => memory.get(key),
      set: (key, value) => void memory.set(key, value),
      remove: (key) => void memory.delete(key),
      clearAll: () => memory.clear(),
    };
  }
}

const preferencesStore = createStore('foodfen.preferences');
const localDataStore = createStore('foodfen.localdata');
const cacheStore = createStore('foodfen.cache');

/** Typed JSON helpers over a raw store. */
function jsonAccessors(store: Store) {
  return {
    get<T>(key: string): T | undefined {
      const raw = store.getString(key);
      if (raw === undefined) return undefined;

      try {
        return JSON.parse(raw) as T;
      } catch {
        // A value written by an older schema. Drop it rather than crash.
        store.remove(key);
        return undefined;
      }
    },
    set(key: string, value: unknown): void {
      store.set(key, JSON.stringify(value));
    },
    remove(key: string): void {
      store.remove(key);
    },
    clear(): void {
      store.clearAll();
    },
    /** Raw string access, for consumers that do their own serialization. */
    raw: store,
  };
}

/** Device settings: theme, units, onboarding state. Survives sign-out. */
export const preferences = jsonAccessors(preferencesStore);

/**
 * The diary, the food catalog, and the local profile — the app's actual data,
 * source-of-truth while there is no backend. See `src/data/` for the
 * repositories built on top of this. Cleared only by an explicit
 * "erase local data" action or by a different account signing in
 * (`claimLocalData`), never by sign-out.
 */
export const localData = jsonAccessors(localDataStore);

/** The persisted TanStack Query cache. Safe to clear at any time. */
export const cache = jsonAccessors(cacheStore);

export const StorageKeys = {
  colorScheme: 'color-scheme',
  locale: 'locale',
  onboardingComplete: 'onboarding-complete',
  accountOwnerId: 'account-owner-id',
  queryCache: 'react-query-cache',
  devSeed: 'dev-seed-enabled',
  hideChallengeProgress: 'hide-challenge-progress',
  seenQuestTypes: 'seen-quest-types',
  streakCommittedDate: 'streak-committed-date',
  questAdvanceCounts: 'quest-advance-counts',
  healthSyncEnabled: 'health-sync-enabled',
  mealRemindersEnabled: 'meal-reminders-enabled',
  streakRemindersEnabled: 'streak-reminders-enabled',
} as const;
