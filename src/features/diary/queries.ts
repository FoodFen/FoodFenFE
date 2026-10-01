import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { foodAiApi } from '@/api/endpoints/foodAi';
import * as diaryRepository from '@/data/diaryRepository';
import * as entryRepository from '@/data/entryRepository';
import type {
  CreateEntryInput,
  CreateManualEntryInput,
  UpdateEntryInput,
  UpdateManualEntryInput,
} from '@/data/entryRepository';
import { getCatalogFood, searchCatalog } from '@/data/foodCatalog';
import * as gamification from '@/data/gamificationRepository';
import * as logRepository from '@/data/logRepository';
import type { AddActivityInput } from '@/data/logRepository';
import { pullDayLogs, pullFoodEntries } from '@/data/pull';
import { pendingChangeCount, readWithRefresh } from '@/data/sync';
import * as userRepository from '@/data/userRepository';
import { suggestedMealType } from '@/features/diary/selectors';
import { reconcileNotifications } from '@/features/notifications/reconcile';
import { useProfileStore } from '@/features/profile/store';
import type { DateKey } from '@/lib/date';
import { isFutureDate, lastNDays, todayKey } from '@/lib/date';
import { findServing, gramsForServing, nutritionForServing } from '@/lib/nutrition';
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
export async function pullDiaryWindow(
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
export function useCatalogSearch(query: string, recentIds?: string[]) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.catalog.search(trimmed),
    queryFn: () => searchCatalog(trimmed, { recentIds }),
    enabled: trimmed.length >= 2,
    retry: false,
  });
}

/**
 * The catalog foods this user logged most recently.
 *
 * A read over past entries, not the catalog — so it sits under `entries` and
 * `useDiaryInvalidation` refreshes it after every log. Feeds the "Gần đây"
 * shortcut on the search screen.
 */
export function useRecentFoods(limit = 8) {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.entries.recent(userId, limit),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return entryRepository.getRecentCatalogFoods(userId, limit);
    },
    enabled: userId !== null,
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

/**
 * Repair a missing `daily_goal` row by recomputing it from the profile — the
 * same call onboarding makes. The dashboard fires this once when `useDiaryDay`
 * throws `MissingGoalError`, then the invalidation lets the day query retry.
 */
export function useHealMissingGoal() {
  const queryClient = useQueryClient();
  const profile = useProfileStore((state) => state.profile);

  return useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('No local profile yet.');

      return userRepository.writeCalculatedGoal(profile);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });
    },
  });
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
      void reconcileNotifications(userId);

      return entry;
    },
    onSuccess: invalidate,
  });
}

export type LogManualEntryInput = Omit<CreateManualEntryInput, 'userId'>;

/**
 * Log a manual aggregate entry (UC-12).
 *
 * Mirrors `useLogMeal` — a local insert then the streak advance — but writes
 * one `food_entry` with the totals the user typed and no ingredient rows.
 */
export function useLogManualEntry() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async (input: LogManualEntryInput) => {
      if (!userId) throw new Error('No local profile yet.');

      const entry = entryRepository.createManualEntry({ ...input, userId });

      gamification.recordActiveDay(userId, input.loggedOn);
      void reconcileNotifications(userId);

      return entry;
    },
    onSuccess: invalidate,
  });
}

export type AnalyzeFoodInput =
  | { type: 'image'; uri: string; fileName: string; mimeType: string }
  | { type: 'text'; description: string; inputMethod?: 'text' | 'voice' };

/**
 * Send a photo or a typed sentence to the backend AI and get back a
 * suggested meal name plus itemized ingredient rows. Read-only network call —
 * nothing is written locally here; the caller feeds the result into
 * `useDraftStore` and lets the meal composer save it, same as any other
 * ingredient source.
 */
export function useAnalyzeFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnalyzeFoodInput) =>
      input.type === 'image'
        ? foodAiApi.analyzeImage(input.uri, input.fileName)
        : foodAiApi.analyzeText(input.description, input.inputMethod),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.aiQuota }),
  });
}

/** Free AI tries left per input method; `unlimited` for Premium. */
export function useAiQuota(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.aiQuota,
    queryFn: foodAiApi.getQuota,
    enabled,
    retry: false,
  });
}

export interface QuickLogFoodInput {
  catalogFoodId: string;
  servingId: string;
  /** How many of the chosen serving. */
  quantity: number;
}

/**
 * Log one catalog food, scaled to a portion, as its own single-item entry.
 *
 * The "search → pick a portion → done" path. The chosen serving's nutrition is
 * scaled and copied onto one ingredient row (`catalogFoodId` kept so the food
 * shows up in "Gần đây" next time); the entry lands on today with the meal
 * guessed from the clock.
 */
export function useQuickLogFood() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ catalogFoodId, servingId, quantity }: QuickLogFoodInput) => {
      if (!userId) throw new Error('No local profile yet.');

      const food = getCatalogFood(catalogFoodId);
      if (!food) throw new Error(`Catalog food ${catalogFoodId} not found.`);

      const serving = findServing(food, servingId) ?? food.servings[0];
      const grams = serving ? gramsForServing(quantity, serving) : quantity;
      const nutrition = nutritionForServing(food, quantity, servingId);
      const today = todayKey();

      const entry = entryRepository.createEntry({
        userId,
        name: food.name,
        mealType: suggestedMealType(),
        inputMethod: 'type',
        loggedOn: today,
        ingredients: [
          {
            name: food.name,
            quantityG: grams,
            kcal: nutrition.kcal,
            carbsG: nutrition.carbsG,
            proteinG: nutrition.proteinG,
            fatG: nutrition.fatG,
            fiberG: nutrition.fiberG ?? null,
            catalogFoodId: food.id,
          },
        ],
      });

      gamification.recordActiveDay(userId, today);
      void reconcileNotifications(userId);

      return entry;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateEntry() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateEntryInput }) => {
      const entry = entryRepository.updateEntry(id, patch);

      // A meal-type change or a move to a different day can flip whether
      // today's reminder for either meal type should still be pending.
      if (userId) void reconcileNotifications(userId);

      return entry;
    },
    onSuccess: invalidate,
  });
}

/**
 * Edit an aggregate (manual) entry's typed numbers.
 *
 * Mirrors `useUpdateEntry` but routes to `updateManualEntry`, which writes the
 * macro columns directly. For an entry that has one ingredient the edit screen
 * uses `useUpdateEntry` with a rebuilt row instead.
 */
export function useUpdateManualEntry() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateManualEntryInput }) => {
      const entry = entryRepository.updateManualEntry(id, patch);

      if (userId) void reconcileNotifications(userId);

      return entry;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteEntry() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      entryRepository.deleteEntry(id);

      // Deleting today's only entry for a meal un-satisfies that meal's
      // reminder — reconcile so it's rescheduled rather than left cancelled.
      if (userId) void reconcileNotifications(userId);
    },
    onSuccess: invalidate,
  });
}

export function useAddWater() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ amountMl, date }: { amountMl: number; date: DateKey }) => {
      if (!userId) throw new Error('No local profile yet.');

      const log = logRepository.addWater(userId, amountMl, date);

      // UC-20 includes UC-22: logging water counts as "did something today",
      // same as every food-logging mutation.
      gamification.recordActiveDay(userId, date);
      void reconcileNotifications(userId);

      return log;
    },
    onSuccess: invalidate,
  });
}

/**
 * Set the day's water total directly (the dashboard's tap-a-cup interaction),
 * rather than adding one more drink.
 */
export function useSetWaterTotal() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async ({ targetMl, date }: { targetMl: number; date: DateKey }) => {
      if (!userId) throw new Error('No local profile yet.');

      logRepository.setWaterTotal(userId, date, targetMl);
      gamification.recordActiveDay(userId, date);
      void reconcileNotifications(userId);
    },
    onSuccess: invalidate,
  });
}

/**
 * Change today's water goal only, carrying every other target over unchanged —
 * `daily_goal` rows are one unit, so editing one field means rewriting the
 * whole row for today, the same way `logWeight` corrects a day in place.
 */
export function useSetWaterGoal() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async (targetWaterMl: number) => {
      if (!userId) throw new Error('No local profile yet.');

      const current = userRepository.getGoalForDate(userId);
      if (!current) throw new Error('No goal set yet.');

      return userRepository.setGoal(userId, {
        targetKcal: current.targetKcal,
        targetCarbsG: current.targetCarbsG,
        targetProteinG: current.targetProteinG,
        targetFatG: current.targetFatG,
        targetWaterMl,
      });
    },
    onSuccess: invalidate,
  });
}

/**
 * Log an activity (a workout / burned calories), UC-16.
 *
 * Mirrors `useLogMeal`: a local insert, then the streak advance (this is the
 * one other place, besides eating, that counts as "did something today"),
 * then the same broad diary invalidation so exercise kcal recomputes.
 */
export function useLogActivity() {
  const userId = useUserId();
  const invalidate = useDiaryInvalidation();

  return useMutation({
    mutationFn: async (input: Omit<AddActivityInput, 'userId'>) => {
      if (!userId) throw new Error('No local profile yet.');

      const log = logRepository.addActivity({ ...input, userId });

      gamification.recordActiveDay(userId, input.date);
      void reconcileNotifications(userId);

      return log;
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
  const profile = useProfileStore((state) => state.profile);

  return useMutation({
    mutationFn: async ({ weight, date }: { weight: number; date: DateKey }) => {
      if (!userId || !profile) throw new Error('No local profile yet.');

      const log = logRepository.logWeight(userId, weight, date);

      // Today's reading is the user's current weight as far as the calorie
      // formula is concerned (`writeCalculatedGoal` resolves it from
      // `weight_log`, not the profile) — recompute today's target so it
      // reflects the weight just logged, same as any other formula-relevant edit.
      if (date === todayKey()) userRepository.refreshGoalIfAuto(profile);

      return log;
    },
    onSuccess: () => {
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
