import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as diaryRepository from '@/data/diaryRepository';
import * as entryRepository from '@/data/entryRepository';
import type { CreateEntryInput, UpdateEntryInput } from '@/data/entryRepository';
import { searchCatalog } from '@/data/foodCatalog';
import * as gamification from '@/data/gamificationRepository';
import * as logRepository from '@/data/logRepository';
import { pullDayLogs, pullFoodEntries } from '@/data/pull';
import { pendingChangeCount, readWithRefresh } from '@/data/sync';
import { useProfileStore } from '@/features/profile/store';
import type { DateKey } from '@/lib/date';
import { isFutureDate, lastNDays, todayKey } from '@/lib/date';
import { queryKeys } from '@/lib/queryClient';

/**
 * Diary reads and writes.
 *
 * Reads go through `readWithRefresh`: when there is a server and the user has
 * signed in for it, the local database is refreshed first; either way the
 * answer is assembled from local rows. Writes are local and immediate, marked
 * unsynced for a push that does not exist yet.
 *
 * `retry: false` throughout — the local read cannot fail transiently, and the
 * remote half already handles its own failure by falling back.
 */

function useUserId(): string | null {
  return useProfileStore((state) => state.profile?.id ?? null);
}

/** Entries and the day-level logs are always refreshed together. */
async function pullDiaryWindow(
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<void> {
  await Promise.all([pullFoodEntries(userId, from, to), pullDayLogs(userId, from, to)]);
}

export function useDiaryDay(date: DateKey) {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.diary.day(date),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return readWithRefresh({
        pull: () => pullDiaryWindow(userId, date, date),
        read: () => diaryRepository.getDiaryDay(userId, date),
      });
    },
    // Nothing can be logged in the future, and there is nothing to show before
    // onboarding has produced a user and a goal.
    enabled: userId !== null && !isFutureDate(date),
    retry: false,
  });
}

export function useDiaryRange(days = 7, endDate: DateKey = todayKey()) {
  const userId = useUserId();
  const range = lastNDays(days, endDate);
  const from = range[0] ?? endDate;
  const to = range[range.length - 1] ?? endDate;

  return useQuery({
    queryKey: queryKeys.diary.range(from, to),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return readWithRefresh({
        pull: () => pullDiaryWindow(userId, from, to),
        read: () => diaryRepository.getDiaryRange(userId, from, to),
      });
    },
    enabled: userId !== null,
    retry: false,
  });
}

export function useEntry(entryId: string) {
  return useQuery({
    queryKey: queryKeys.entries.byId(entryId),
    queryFn: () => {
      const entry = entryRepository.getEntry(entryId);

      if (!entry) throw new Error(`Entry ${entryId} was not found.`);

      return entry;
    },
    retry: false,
  });
}

/**
 * The bundled reference list, for prefilling an ingredient.
 *
 * Never hits the network — this list ships in the bundle. A server-backed
 * catalog would be a separate hook, so this one keeps working offline.
 */
export function useCatalogSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.catalog.search(trimmed),
    queryFn: () => searchCatalog(trimmed),
    enabled: trimmed.length >= 2,
    retry: false,
  });
}

/** Invalidate everything a diary write can affect. */
function useDiaryInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.entries.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sync.all });
  };
}

export type LogMealInput = Omit<CreateEntryInput, 'userId'>;

/**
 * Log a meal.
 *
 * The write completes before the mutation resolves — it is a local database
 * insert — so there is nothing to be optimistic about and nothing to roll
 * back. Logging also advances the streak: this is the one place that knows
 * the user did something on a given day.
 */
export function useLogMeal() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async (input: LogMealInput) => {
      if (!userId) throw new Error('No local profile yet.');

      const entry = entryRepository.createEntry({ ...input, userId });

      gamification.recordActiveDay(userId, input.loggedOn);

      return entry;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateEntry() {
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateEntryInput }) =>
      entryRepository.updateEntry(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteEntry() {
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => entryRepository.deleteEntry(id),
    onSuccess: invalidate,
  });
}

export function useAddWater() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ amountMl, date }: { amountMl: number; date: DateKey }) => {
      if (!userId) throw new Error('No local profile yet.');

      return logRepository.addWater(userId, amountMl, date);
    },
    onSuccess: invalidate,
  });
}

export function useRemoveLastWater() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ date }: { date: DateKey }) => {
      if (!userId) throw new Error('No local profile yet.');

      return logRepository.removeLastWater(userId, date);
    },
    onSuccess: invalidate,
  });
}

export function useLogWeight() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const refreshProfile = useProfileStore((state) => state.refresh);
  const saveProfile = useProfileStore((state) => state.saveProfile);

  return useMutation({
    mutationFn: async ({ weight, date }: { weight: number; date: DateKey }) => {
      if (!userId) throw new Error('No local profile yet.');

      const log = logRepository.logWeight(userId, weight, date);

      // Today's reading is also the user's current weight, which the calorie
      // target is derived from. Recording one without the other would leave
      // the goal keyed to a weight the user no longer has.
      if (date === todayKey()) saveProfile({ weightCurrent: weight });

      return log;
    },
    onSuccess: () => {
      refreshProfile();
      void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weight.all });
    },
  });
}

export function useWeightHistory(days = 30) {
  const userId = useUserId();
  const range = lastNDays(days);
  const from = range[0] ?? todayKey();
  const to = range[range.length - 1] ?? todayKey();

  return useQuery({
    queryKey: queryKeys.weight.range(from, to),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return logRepository.getWeightHistory(userId, from, to);
    },
    enabled: userId !== null,
    retry: false,
  });
}

/** How many local writes are still waiting for a server that can take them. */
export function usePendingChanges() {
  return useQuery({
    queryKey: queryKeys.sync.pending(),
    queryFn: () => pendingChangeCount(),
    retry: false,
  });
}
