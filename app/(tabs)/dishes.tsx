import { router } from 'expo-router';
import { RefreshControl } from 'react-native';

import { isApiError } from '@/api/errors';
import { DishRow } from '@/components/dishes/DishRow';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import {
  useAddDishToDiary,
  useDishes,
  useDishesAvailable,
} from '@/features/dishes/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

/** Dishes from approved restaurants, in the order the server returns them. */
export default function DishesScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const available = useDishesAvailable();
  const { data, isPending, fetchStatus, error, refetch, isRefetching } =
    useDishes(todayKey());
  const add = useAddDishToDiary();

  if (!available) {
    return (
      <Screen tabBar topInset>
        <EmptyState
          icon="🔒"
          title={t('dishes', 'needsSignIn')}
          actionLabel={t('dishes', 'signIn')}
          onAction={() => router.push('/sign-in')}
        />
      </Screen>
    );
  }

  if (!data && isPending && fetchStatus === 'paused') {
    return (
      <Screen tabBar topInset>
        <EmptyState icon="📡" title={t('dishes', 'needsConnection')} />
      </Screen>
    );
  }

  if (!data && isPending) {
    return (
      <ScrollScreen tabBar topInset>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </ScrollScreen>
    );
  }

  if (!data) {
    return (
      <Screen tabBar topInset>
        <ErrorState
          description={isApiError(error) ? error.userMessage : t('dishes', 'loadError')}
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const { remainingKcal, dishes } = data;

  return (
    <ScrollScreen
      tabBar
      topInset
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colorsFor(resolved).fgMuted}
        />
      }
    >
      <Text variant="heading">
        {remainingKcal === null
          ? t('dishes', 'noGoalHint')
          : remainingKcal > 0
            ? t('dishes', 'remaining').replace('{kcal}', remainingKcal.toLocaleString())
            : t('dishes', 'overGoal')}
      </Text>

      {dishes.length === 0 ? (
        <EmptyState
          icon="🍜"
          title={t('dishes', 'emptyTitle')}
          description={t('dishes', 'emptyDescription')}
        />
      ) : (
        dishes.map((dish) => (
          <DishRow
            key={dish.id}
            dish={dish}
            restaurantName={dish.restaurant.name}
            fits={dish.fits}
            onPress={() =>
              router.push({
                pathname: '/restaurant/[id]',
                params: { id: dish.restaurant.id },
              })
            }
            onAdd={() => add.mutate(dish)}
            adding={add.isPending && add.variables?.id === dish.id}
          />
        ))
      )}
    </ScrollScreen>
  );
}
