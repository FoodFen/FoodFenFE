import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { diaryApi } from '@/api/endpoints/diary';
import type { UpdateEntryPayload } from '@/api/endpoints/diary';
import { foodsApi } from '@/api/endpoints/foods';
import type { DateKey } from '@/lib/date';
import { isFutureDate, lastNDays, todayKey } from '@/lib/date';
import { nutritionForPortion, sumNutrition } from '@/lib/nutrition';
import { queryKeys } from '@/lib/queryClient';
import type { DiaryDay, Food, FoodEntry, MealType } from '@/types/models';

/** One day of the diary. */
export function useDiaryDay(date: DateKey) {
  return useQuery({
    queryKey: queryKeys.diary.day(date),
    queryFn: ({ signal }) => diaryApi.day(date, signal),
    // Nothing can be logged in the future, so never spend a request on it.
    enabled: !isFutureDate(date),
  });
}

/** A trailing window of days, for the trends screen. */
export function useDiaryRange(days = 7, endDate: DateKey = todayKey()) {
  const range = lastNDays(days, endDate);
  const from = range[0] ?? endDate;
  const to = range[range.length - 1] ?? endDate;

  return useQuery({
    queryKey: queryKeys.diary.range(from, to),
    queryFn: ({ signal }) => diaryApi.range(from, to, signal),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Paged food search. `enabled` gates on a non-empty query so an empty search
 * box does not hammer the catalog endpoint.
 */
export function useFoodSearch(query: string) {
  const trimmed = query.trim();

  return useInfiniteQuery({
    queryKey: queryKeys.foods.search(trimmed),
    queryFn: ({ pageParam, signal }) =>
      foodsApi.search({ query: trimmed, cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: trimmed.length >= 2,
    staleTime: 1000 * 60 * 10,
  });
}

export function useFrequentFoods() {
  return useQuery({
    queryKey: queryKeys.foods.frequent(),
    queryFn: () => foodsApi.frequent(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useFood(id: string) {
  return useQuery({
    queryKey: queryKeys.foods.byId(id),
    queryFn: () => foodsApi.byId(id),
    staleTime: 1000 * 60 * 60,
  });
}

export interface LogFoodInput {
  date: DateKey;
  mealType: MealType;
  food: Food;
  quantity: number;
  servingUnitId: string;
  notes?: string;
  photoUri?: string;
}

/**
 * Recompute a day's totals from its entries.
 *
 * The server sends totals too, but an optimistic entry has to update them
 * locally or the header would disagree with the list until the round trip
 * lands.
 */
function withRecalculatedTotals(day: DiaryDay, entries: FoodEntry[]): DiaryDay {
  return {
    ...day,
    entries,
    totals: sumNutrition(entries.map((entry) => entry.nutrition)),
  };
}

/**
 * Log a food, applied optimistically.
 *
 * Logging is the app's core interaction and often happens on a bad connection,
 * so the entry must appear instantly and roll back cleanly if the write fails.
 */
export function useLogFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LogFoodInput) =>
      diaryApi.createEntry({
        date: input.date,
        mealType: input.mealType,
        foodId: input.food.id,
        quantity: input.quantity,
        servingUnitId: input.servingUnitId,
        notes: input.notes,
        photoUri: input.photoUri,
      }),

    onMutate: async (input) => {
      const key = queryKeys.diary.day(input.date);

      // Stop an in-flight refetch from overwriting the optimistic entry.
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<DiaryDay>(key);

      const optimisticEntry: FoodEntry = {
        id: `optimistic-${Date.now()}`,
        date: input.date,
        mealType: input.mealType,
        food: input.food,
        quantity: input.quantity,
        servingUnitId: input.servingUnitId,
        nutrition: nutritionForPortion(input.food, input.quantity, input.servingUnitId),
        notes: input.notes,
        photoUri: input.photoUri,
        loggedAt: new Date().toISOString(),
      };

      if (previous) {
        queryClient.setQueryData<DiaryDay>(
          key,
          withRecalculatedTotals(previous, [...previous.entries, optimisticEntry]),
        );
      }

      return { previous, key, optimisticId: optimisticEntry.id };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSuccess: (created, _input, context) => {
      if (!context) return;

      // Swap the placeholder for the server's row so its real id is available
      // to edit and delete without waiting for a refetch.
      const day = queryClient.getQueryData<DiaryDay>(context.key);
      if (!day) return;

      const entries = day.entries.map((entry) =>
        entry.id === context.optimisticId ? created : entry,
      );

      queryClient.setQueryData(context.key, withRecalculatedTotals(day, entries));
    },

    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.diary.day(input.date) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.recent() });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateEntryPayload;
      date: DateKey;
    }) => diaryApi.updateEntry(id, patch),

    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.diary.day(variables.date),
      });

      // An entry moved to another day invalidates that day too.
      if (variables.patch.date && variables.patch.date !== variables.date) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.diary.day(variables.patch.date),
        });
      }
    },
  });
}

/** Remove an entry, applied optimistically so the row disappears on tap. */
export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; date: DateKey }) => diaryApi.deleteEntry(id),

    onMutate: async ({ id, date }) => {
      const key = queryKeys.diary.day(date);

      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DiaryDay>(key);

      if (previous) {
        queryClient.setQueryData<DiaryDay>(
          key,
          withRecalculatedTotals(
            previous,
            previous.entries.filter((entry) => entry.id !== id),
          ),
        );
      }

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.diary.day(variables.date),
      });
    },
  });
}

export function useSetWater() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ date, waterMl }: { date: DateKey; waterMl: number }) =>
      diaryApi.setWater(date, waterMl),

    onMutate: async ({ date, waterMl }) => {
      const key = queryKeys.diary.day(date);

      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DiaryDay>(key);

      if (previous) {
        queryClient.setQueryData<DiaryDay>(key, { ...previous, waterMl });
      }

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.diary.day(variables.date),
      });
    },
  });
}
