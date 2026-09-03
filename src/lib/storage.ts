import { createMMKV } from 'react-native-mmkv';

/**
 * Synchronous key-value storage.
 *
 * Two separate instances so cached server data can be cleared on sign-out
 * without wiping the user's device-local preferences.
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

/** Survives sign-out: theme, units, onboarding state. */
export const preferences = jsonAccessors(preferencesStore);

/** Cleared on sign-out: cached diary data, food search results. */
export const cache = jsonAccessors(cacheStore);

export const StorageKeys = {
  colorScheme: 'color-scheme',
  onboardingComplete: 'onboarding-complete',
  lastViewedDate: 'last-viewed-date',
  recentFoodIds: 'recent-food-ids',
  queryCache: 'react-query-cache',
} as const;
