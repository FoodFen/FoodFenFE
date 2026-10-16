import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';

import { dishesApi } from '@/api/endpoints/dishes';
import type { DishFilters } from '@/api/endpoints/dishes';
import { userErrorMessage } from '@/api/errors';
import type { RemoteDish, RemoteDishList } from '@/api/schemas';
import { useAuthStore } from '@/features/auth/store';
import { useLogManualEntry } from '@/features/diary/queries';
import { suggestedMealType } from '@/features/diary/selectors';
import { dishToManualEntry, overKcal } from '@/features/dishes/mappers';
import { usePostLogInterstitial } from '@/features/gamification/queries';
import { useTranslation } from '@/hooks/useTranslation';
import type { DateKey } from '@/lib/date';
import { todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { queryKeys } from '@/lib/queryClient';
import type { MealType } from '@/types/models';

export function useDishesAvailable(): boolean {
  const signedIn = useAuthStore((state) => state.session !== null);

  return signedIn && env.hasBackend;
}

export function useDishes(date: DateKey, filters: DishFilters = {}, limit?: number) {
  const available = useDishesAvailable();

  return useQuery({
    queryKey: queryKeys.dishes.list(date, filters, limit),
    queryFn: ({ signal }) => dishesApi.list({ date, ...filters, limit }, signal),
    enabled: available,
    retry: false,
  });
}

export function useInfiniteDishes(date: DateKey, filters: DishFilters = {}) {
  const available = useDishesAvailable();

  return useInfiniteQuery({
    queryKey: queryKeys.dishes.infinite(date, filters),
    queryFn: ({ pageParam, signal }) =>
      dishesApi.list({ date, ...filters, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => {
      // Rows can shift between pages when a dish is logged, so a dish may repeat.
      const seen = new Set<string>();
      const dishes = data.pages
        .flatMap((page) => page.dishes)
        .filter((dish) => !seen.has(dish.id) && seen.add(dish.id));

      return {
        remainingKcal: data.pages[0]?.remainingKcal ?? null,
        dishes,
        featured: data.pages[0]?.featured ?? [],
      };
    },
    enabled: available,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useRestaurant(id: string) {
  const available = useDishesAvailable();

  return useQuery({
    queryKey: queryKeys.dishes.restaurant(id),
    queryFn: ({ signal }) => dishesApi.restaurant(id, signal),
    enabled: available,
    retry: false,
  });
}

/**
 * Logs a dish through the same local path as manual logging (the existing push
 * sync uploads it), then optimistically lowers today's cached `remainingKcal`.
 * The server has not seen the entry yet, so no refetch here; the invalidation
 * after the next push brings back the server's `remainingKcal` and `fits`.
 */
export function useAddDishToDiary() {
  const queryClient = useQueryClient();
  const logManual = useLogManualEntry();
  const finishLogging = usePostLogInterstitial();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ dish, mealType }: { dish: RemoteDish; mealType: MealType }) =>
      logManual.mutateAsync(dishToManualEntry(dish, mealType, todayKey())),
    onSuccess: (_entry, { dish }) => {
      haptics.success();

      // Whole kcal, matching the integer the server sends.
      const kcal = Math.round(dish.kcal);
      const lower = (list: RemoteDishList): RemoteDishList =>
        list.remainingKcal === null
          ? list
          : { ...list, remainingKcal: list.remainingKcal - kcal };

      queryClient.setQueriesData<RemoteDishList>(
        { queryKey: [...queryKeys.dishes.all, 'list', todayKey()] },
        (list) => list && lower(list),
      );
      queryClient.setQueriesData<InfiniteData<RemoteDishList>>(
        { queryKey: [...queryKeys.dishes.all, 'infinite', todayKey()] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page, index) => (index === 0 ? lower(page) : page)),
          },
      );

      finishLogging();
    },
    onError: (error) => {
      haptics.error();
      Alert.alert(
        t('dishes', 'addErrorTitle'),
        userErrorMessage(error, t('common', 'pleaseTryAgain')),
      );
    },
  });
}

export function useConfirmAddDish() {
  const { t } = useTranslation();
  const mutation = useAddDishToDiary();
  const [adjusting, setAdjusting] = useState<RemoteDish | null>(null);

  const request = (dish: RemoteDish, remainingKcal: number | null) => {
    const lines = [
      `${dish.name} · ${Math.round(dish.kcal)} kcal → ${t('mealType', suggestedMealType())}`,
    ];

    if (remainingKcal !== null) {
      // Whole kcal for display only.
      const over = overKcal(dish, remainingKcal);
      lines.push(
        over === undefined
          ? t('dishes', 'confirmLeft').replace('{kcal}', String(Math.round(remainingKcal - dish.kcal)))
          : t('dishes', 'confirmOver').replace('{kcal}', String(over)),
      );
    }

    Alert.alert(t('dishes', 'confirmTitle'), lines.join('\n'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('dishes', 'adjust'), onPress: () => setAdjusting(dish) },
      {
        text: t('dishes', 'confirmAdd'),
        onPress: () => mutation.mutate({ dish, mealType: suggestedMealType() }),
      },
    ]);
  };

  const addWithMeal = (mealType: MealType) => {
    if (adjusting) mutation.mutate({ dish: adjusting, mealType });
    setAdjusting(null);
  };

  return {
    request,
    adjusting,
    closeAdjust: () => setAdjusting(null),
    addWithMeal,
    isAdding: (dishId: string) => mutation.isPending && mutation.variables?.dish.id === dishId,
    isAdded: (dishId: string) => mutation.isSuccess && mutation.variables?.dish.id === dishId,
  };
}
