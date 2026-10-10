import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  useWindowDimensions,
  View,
} from 'react-native';

import type { DishFilters } from '@/api/endpoints/dishes';
import { isApiError } from '@/api/errors';
import { DishRow } from '@/components/dishes/DishRow';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { overKcal } from '@/features/dishes/mappers';
import {
  useConfirmAddDish,
  useDishes,
  useDishesAvailable,
} from '@/features/dishes/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { queryKeys } from '@/lib/queryClient';
import { colorsFor } from '@/theme/colors';

type DishesQuery = ReturnType<typeof useDishes>;

const CARD_GAP = 12;
const SECTION_LIMIT = 10;

/** Dishes from approved restaurants, in the order the server returns them. */
export default function DishesScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const available = useDishesAvailable();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const allQuery = useDishes(todayKey(), {}, SECTION_LIMIT);
  const fitsQuery = useDishes(todayKey(), { fits: true }, SECTION_LIMIT);
  const add = useConfirmAddDish();
  const { data, isPending, fetchStatus, error, refetch } = allQuery;

  const sections: {
    key: string;
    title: string;
    filters: DishFilters;
    query: DishesQuery;
  }[] = [
    { key: 'fits', title: t('dishes', 'sectionFits'), filters: { fits: true }, query: fitsQuery },
    { key: 'all', title: t('dishes', 'sectionAll'), filters: {}, query: allQuery },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all });
    setRefreshing(false);
  };

  const openList = () =>
    router.push({ pathname: '/dish-list', params: { focus: '1' } });

  if (!available) {
    return (
      <Screen tabBar topInset>
        <EmptyState
          icon="lock-closed-outline"
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
        <EmptyState icon="cloud-offline-outline" title={t('dishes', 'needsConnection')} />
      </Screen>
    );
  }

  if (!data && isPending) {
    return (
      <ScrollScreen tabBar topInset>
        <Skeleton className="h-24 rounded-card" />
        {[0, 1].map((i) => (
          <View key={i} className="gap-2">
            <Skeleton className="h-40 rounded-card" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </View>
        ))}
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

  const { remainingKcal } = data;

  return (
    <ScrollScreen
      tabBar
      topInset
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.fgMuted}
        />
      }
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={openList}
          accessibilityRole="button"
          accessibilityLabel={t('dishes', 'searchPlaceholder')}
          className="h-12 flex-1 flex-row items-center gap-2 rounded-card bg-surface-alt px-3"
        >
          <Ionicons name="search" size={18} color={colors.fgSubtle} />
          <Text variant="body" tone="subtle" numberOfLines={1} className="flex-1">
            {t('dishes', 'searchPlaceholder')}
          </Text>
        </Pressable>
        <Pressable
          onPress={openList}
          accessibilityRole="button"
          accessibilityLabel={t('dishes', 'filters')}
          className="h-12 w-12 items-center justify-center rounded-card bg-surface-alt"
        >
          <Ionicons name="options-outline" size={22} color={colors.fgMuted} />
        </Pressable>
      </View>

      <Card className="gap-1 border-0 bg-brand-soft">
        {remainingKcal === null ? (
          <Text variant="body" tone="muted">
            {t('dishes', 'noGoalHint')}
          </Text>
        ) : remainingKcal > 0 ? (
          <>
            <Text variant="caption" tone="muted">
              {t('dishes', 'remainingLabel')}
            </Text>
            <View className="flex-row items-baseline gap-2">
              <Text variant="display">{remainingKcal.toLocaleString()}</Text>
              <Text variant="label" tone="muted">
                kcal
              </Text>
            </View>
          </>
        ) : (
          <Text variant="heading" tone="warning">
            {t('dishes', 'overGoal')}
          </Text>
        )}
      </Card>

      {sections.map((section) =>
        section.key === 'all' && section.query.data?.dishes.length === 0 ? (
          <EmptyState
            key={section.key}
            icon="restaurant-outline"
            title={t('dishes', 'emptyTitle')}
            description={t('dishes', 'emptyDescription')}
          />
        ) : (
          <DishSection
            key={section.key}
            title={section.title}
            filters={section.filters}
            query={section.query}
            remainingKcal={remainingKcal}
            add={add}
          />
        )
      )}
    </ScrollScreen>
  );
}

function DishSection({
  title,
  filters,
  query,
  remainingKcal,
  add,
}: {
  title: string;
  filters: DishFilters;
  query: DishesQuery;
  remainingKcal: number | null;
  add: ReturnType<typeof useConfirmAddDish>;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const { width } = useWindowDimensions();
  const itemWidth = Math.round(width * 0.75);
  const dishes = query.data?.dishes;

  if (!dishes && !query.isPending) return null;
  if (dishes?.length === 0) {
    if (!filters.fits || remainingKcal === null || remainingKcal <= 0) return null;

    return (
      <View className="gap-3">
        <Text variant="heading">{title}</Text>
        <Card>
          <Text variant="body" tone="muted">
            {t('dishes', 'noFitNote').replace('{kcal}', remainingKcal.toLocaleString())}
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="heading">{title}</Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/dish-list',
              params: filters.fits ? { fits: '1' } : {},
            })
          }
          accessibilityRole="button"
          className="flex-row items-center gap-1 py-1"
        >
          <Text variant="label" tone="brand">
            {t('dishes', 'viewAll')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colorsFor(resolved).brand} />
        </Pressable>
      </View>

      {dishes ? (
        <FlatList
          horizontal
          className="-mx-4 grow-0"
          contentContainerClassName="gap-3 px-4"
          data={dishes}
          keyExtractor={(dish) => dish.id}
          snapToInterval={itemWidth + CARD_GAP}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: dish }) => (
            <View style={{ width: itemWidth }}>
              <DishRow
                dish={dish}
                restaurantName={dish.restaurant.name}
                fits={dish.fits}
                onPress={() =>
                  router.push({
                    pathname: '/restaurant/[id]',
                    params: { id: dish.restaurant.id },
                  })
                }
                overKcal={overKcal(dish, remainingKcal)}
                onAdd={() => add.request(dish, remainingKcal)}
                adding={add.isAdding(dish.id)}
                added={add.isAdded(dish.id)}
              />
            </View>
          )}
        />
      ) : (
        <View className="flex-row gap-3">
          {[0, 1].map((i) => (
            <View key={i} style={{ width: itemWidth }}>
              <Skeleton className="h-64 rounded-card" />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
