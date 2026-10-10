import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Alert } from 'react-native';

import { dishesApi } from '@/api/endpoints/dishes';
import type { DishFilters } from '@/api/endpoints/dishes';
import type { RemoteDish } from '@/api/schemas';
import { useAuthStore } from '@/features/auth/store';
import { useLogManualEntry } from '@/features/diary/queries';
import { suggestedMealType } from '@/features/diary/selectors';
import { dishToManualEntry, overKcal } from '@/features/dishes/mappers';
import { useTranslation } from '@/hooks/useTranslation';
import type { DateKey } from '@/lib/date';
import { todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { queryKeys } from '@/lib/queryClient';

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

      return { remainingKcal: data.pages[0]?.remainingKcal ?? null, dishes };
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
 * sync uploads it), then refetches the dish list so `remainingKcal` and `fits`
 * reflect the new entry.
 */
export function useAddDishToDiary() {
  const queryClient = useQueryClient();
  const logManual = useLogManualEntry();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (dish: RemoteDish) =>
      logManual.mutateAsync(dishToManualEntry(dish, suggestedMealType(), todayKey())),
    onSuccess: () => {
      haptics.success();

      return queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all });
    },
    onError: (error) => {
      haptics.error();
      Alert.alert(
        t('dishes', 'addErrorTitle'),
        error instanceof Error ? error.message : t('common', 'pleaseTryAgain'),
      );
    },
  });
}

export function useConfirmAddDish() {
  const { t } = useTranslation();
  const mutation = useAddDishToDiary();

  const request = (dish: RemoteDish & { fits: boolean }, remainingKcal: number | null) => {
    const lines = [
      `${dish.name} · ${Math.round(dish.kcal)} kcal → ${t('mealType', suggestedMealType())}`,
    ];

    if (remainingKcal !== null) {
      // Whole kcal for display only.
      lines.push(
        dish.fits
          ? t('dishes', 'confirmLeft').replace('{kcal}', String(Math.round(remainingKcal - dish.kcal)))
          : t('dishes', 'confirmOver').replace(
              '{kcal}',
              String(overKcal(dish, remainingKcal)),
            ),
      );
    }

    Alert.alert(t('dishes', 'confirmTitle'), lines.join('\n'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('dishes', 'confirmAdd'), onPress: () => mutation.mutate(dish) },
    ]);
  };

  return {
    request,
    isAdding: (dishId: string) => mutation.isPending && mutation.variables?.id === dishId,
    isAdded: (dishId: string) => mutation.isSuccess && mutation.variables?.id === dishId,
  };
}
