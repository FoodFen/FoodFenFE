import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { dishesApi } from '@/api/endpoints/dishes';
import type { RemoteDish } from '@/api/schemas';
import { pushAll } from '@/data/push';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { useLogManualEntry } from '@/features/diary/queries';
import { suggestedMealType } from '@/features/diary/selectors';
import { dishToManualEntry } from '@/features/dishes/mappers';
import { useProfileStore } from '@/features/profile/store';
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

export function useDishes(date: DateKey) {
  const available = useDishesAvailable();
  const profile = useProfileStore((state) => state.profile);

  return useQuery({
    queryKey: queryKeys.dishes.list(date),
    queryFn: async ({ signal }) => {
      // The server computes remainingKcal/fits from the rows it has been sent,
      // so push local diary changes first. Best-effort: offline or a failed
      // push must not stop the list from loading.
      if (profile && canUseRemote()) await pushAll(profile).catch(() => {});

      return dishesApi.list(date, signal);
    },
    enabled: available,
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
