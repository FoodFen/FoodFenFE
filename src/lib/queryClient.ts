import { QueryClient, defaultShouldDehydrateQuery } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';

import { isApiError } from '@/api/errors';

import { StorageKeys, cache } from './storage';

/** How long persisted cache stays usable before it is discarded on load. */
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * A tracker is read far more than it is written, and users open it on the
 * subway. Data stays fresh for a minute and usable for a day, so the diary
 * paints instantly from cache and revalidates behind the paint.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        gcTime: CACHE_MAX_AGE_MS,
        retry: (failureCount, error) => {
          // Never retry what will fail identically the second time.
          if (isApiError(error) && !error.isRetryable) return false;

          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        // React Native has no window focus; `AppState` drives refetching
        // instead, wired up in `useOnlineManager`/`useAppStateFocus`.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: (failureCount, error) => {
          if (isApiError(error) && !error.isRetryable) return false;

          return failureCount < 1;
        },
      },
    },
  });
}

/**
 * Persist the cache to MMKV. MMKV is synchronous, so the async `Persister`
 * interface here is a thin wrapper rather than real async work.
 */
export function createMmkvPersister(): Persister {
  return {
    persistClient: async (client) => {
      cache.set(StorageKeys.queryCache, client);
    },
    restoreClient: async () => cache.get(StorageKeys.queryCache),
    removeClient: async () => {
      cache.remove(StorageKeys.queryCache);
    },
  };
}

export const persistOptions = {
  persister: createMmkvPersister(),
  maxAge: CACHE_MAX_AGE_MS,
  /**
   * Bump when the shape of cached data changes; a mismatched buster discards
   * the old cache instead of feeding stale shapes into new components.
   */
  buster: 'v1',
  /**
   * Chat has no offline identity (see the AI chat design spec) — its history
   * is never written to MMKV, so excluding it here is the enforcement point
   * for that boundary.
   */
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      defaultShouldDehydrateQuery(query) && query.queryKey[0] !== 'chat',
  },
};

/**
 * Query keys in one place.
 *
 * Keys are hierarchical so a broad invalidation works without listing every
 * child: invalidating `diary.all` also invalidates every day and range under it.
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
  diary: {
    all: ['diary'] as const,
    day: (date: string) => [...queryKeys.diary.all, 'day', date] as const,
    range: (from: string, to: string) =>
      [...queryKeys.diary.all, 'range', from, to] as const,
  },
  entries: {
    all: ['entries'] as const,
    byId: (id: string) => [...queryKeys.entries.all, id] as const,
    /** Recently logged catalog foods — derived from entries, so it lives here
     * and the standard diary invalidation refreshes it after every log. */
    recent: (userId: string | null, limit: number) =>
      [...queryKeys.entries.all, 'recent', userId, limit] as const,
  },
  weight: {
    all: ['weight'] as const,
    asOf: (date: string) => [...queryKeys.weight.all, 'asOf', date] as const,
    range: (from: string, to: string) => [...queryKeys.weight.all, from, to] as const,
  },
  /** The bundled reference list. Local-only, never invalidated by a write. */
  catalog: {
    all: ['catalog'] as const,
    search: (query: string) => [...queryKeys.catalog.all, 'search', query] as const,
  },
  gamification: {
    all: ['gamification'] as const,
    streak: () => [...queryKeys.gamification.all, 'streak'] as const,
    quests: (date: string) => [...queryKeys.gamification.all, 'quests', date] as const,
    coins: () => [...queryKeys.gamification.all, 'coins'] as const,
  },
  health: {
    all: ['health'] as const,
    steps: (date: string) => [...queryKeys.health.all, 'steps', date] as const,
  },
  sync: {
    all: ['sync'] as const,
    pending: () => [...queryKeys.sync.all, 'pending'] as const,
  },
  chat: {
    all: ['chat'] as const,
    history: () => [...queryKeys.chat.all, 'history'] as const,
  },
  premium: {
    all: ['premium'] as const,
    tier: () => [...queryKeys.premium.all, 'tier'] as const,
    payment: (orderCode: number) => [...queryKeys.premium.all, 'payment', orderCode] as const,
  },
} as const;
