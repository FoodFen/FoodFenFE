import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import type { DishFilters } from '@/api/endpoints/dishes';
import { isApiError } from '@/api/errors';
import { DishRow } from '@/components/dishes/DishRow';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { overKcal } from '@/features/dishes/mappers';
import {
  useConfirmAddDish,
  useDishesAvailable,
  useInfiniteDishes,
} from '@/features/dishes/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

type ChipGroup = 'fits' | 'kcal' | 'price' | 'protein';

interface Chip {
  key: string;
  group: ChipGroup;
  label?: string;
  labelKey?: 'filterFits' | 'filterHighProtein';
  filters: DishFilters;
}

const CHIPS: Chip[] = [
  { key: 'fits', group: 'fits', labelKey: 'filterFits', filters: { fits: true } },
  { key: 'kcalLow', group: 'kcal', label: '≤300 kcal', filters: { kcalMax: 300 } },
  { key: 'kcalMid', group: 'kcal', label: '300–600 kcal', filters: { kcalMin: 300, kcalMax: 600 } },
  { key: 'kcalHigh', group: 'kcal', label: '≥600 kcal', filters: { kcalMin: 600 } },
  { key: 'priceLow', group: 'price', label: '≤50k', filters: { priceMax: 50000 } },
  { key: 'priceMid', group: 'price', label: '50k–100k', filters: { priceMin: 50000, priceMax: 100000 } },
  { key: 'priceHigh', group: 'price', label: '≥100k', filters: { priceMin: 100000 } },
  { key: 'protein', group: 'protein', labelKey: 'filterHighProtein', filters: { proteinMin: 25 } },
];

type Selection = Partial<Record<ChipGroup, string>>;

export default function DishListScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const params = useLocalSearchParams<{ focus?: string; fits?: string }>();
  const available = useDishesAvailable();
  const add = useConfirmAddDish();

  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>(
    params.fits === '1' ? { fits: 'fits' } : {},
  );
  const [refreshing, setRefreshing] = useState(false);

  const q = useDebounce(query, 300).trim();
  const filters = CHIPS.reduce<DishFilters>(
    (acc, chip) => (selection[chip.group] === chip.key ? { ...acc, ...chip.filters } : acc),
    q ? { q } : {},
  );

  const {
    data,
    isPending,
    fetchStatus,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteDishes(todayKey(), filters);

  const toggle = (chip: Chip) =>
    setSelection((prev) => ({
      ...prev,
      [chip.group]: prev[chip.group] === chip.key ? undefined : chip.key,
    }));

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const body = () => {
    if (!available) {
      return (
        <EmptyState
          icon="lock-closed-outline"
          title={t('dishes', 'needsSignIn')}
          actionLabel={t('dishes', 'signIn')}
          onAction={() => router.push('/sign-in')}
        />
      );
    }

    if (!data && isPending && fetchStatus === 'paused') {
      return <EmptyState icon="cloud-offline-outline" title={t('dishes', 'needsConnection')} />;
    }

    if (!data && isPending) {
      return (
        <View className="gap-4 px-4 pt-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="gap-2">
              <Skeleton className="h-40 rounded-card" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </View>
          ))}
        </View>
      );
    }

    if (!data) {
      return (
        <ErrorState
          description={isApiError(error) ? error.userMessage : t('dishes', 'loadError')}
          onRetry={() => void refetch()}
        />
      );
    }

    return (
      <FlatList
        data={data.dishes}
        keyExtractor={(dish) => dish.id}
        contentContainerClassName="gap-4 px-4 pb-4 pt-2"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.fgMuted}
          />
        }
        ListEmptyComponent={<EmptyState icon="search-outline" title={t('dishes', 'noResults')} />}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={colors.fgMuted} /> : null
        }
        renderItem={({ item: dish }) => (
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
            overKcal={overKcal(dish, data.remainingKcal)}
            onAdd={() => add.request(dish, data.remainingKcal)}
            adding={add.isAdding(dish.id)}
            added={add.isAdded(dish.id)}
          />
        )}
      />
    );
  };

  return (
    <Screen edgeToEdgeBottom>
      <View className="px-4 pb-2 pt-3">
        <View className="h-12 flex-row items-center gap-2 rounded-card bg-surface-alt px-3">
          <Ionicons name="search" size={18} color={colors.fgSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('dishes', 'searchPlaceholder')}
            placeholderTextColor={colors.fgSubtle}
            autoFocus={params.focus === '1'}
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
            accessibilityLabel={t('dishes', 'searchPlaceholder')}
            className="h-full flex-1 font-sans text-base text-fg"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t('dishes', 'clearSearch')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={colors.fgSubtle} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        className="grow-0"
        contentContainerClassName="gap-2 px-4 pb-2"
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {CHIPS.map((chip) => {
          const selected = selection[chip.group] === chip.key;

          return (
            <Pressable
              key={chip.key}
              onPress={() => toggle(chip)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={cn('rounded-pill px-3 py-2', selected ? 'bg-brand' : 'bg-surface-alt')}
            >
              <Text variant="label" tone={selected ? 'onBrand' : 'default'}>
                {chip.labelKey ? t('dishes', chip.labelKey) : chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {body()}
    </Screen>
  );
}
