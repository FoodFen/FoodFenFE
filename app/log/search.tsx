import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useFoodSearch, useFrequentFoods } from '@/features/diary/queries';
import { suggestedMealType } from '@/features/diary/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';
import type { Food, MealType } from '@/types/models';

/**
 * Food search.
 *
 * With no query typed, the list shows the user's frequent foods — in a tracker
 * most logging is repeat logging, so the fast path is recognizing a food you
 * already eat rather than searching the catalog.
 */
export default function FoodSearchScreen() {
  const params = useLocalSearchParams<{ date?: string; mealType?: MealType }>();
  const date = params.date ?? todayKey();
  const mealType = params.mealType ?? suggestedMealType();

  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const isSearching = debouncedQuery.trim().length >= 2;

  const search = useFoodSearch(debouncedQuery);
  const frequent = useFrequentFoods();

  const results = useMemo<Food[]>(() => {
    if (isSearching) {
      return search.data?.pages.flatMap((page) => page.items) ?? [];
    }

    return frequent.data ?? [];
  }, [isSearching, search.data, frequent.data]);

  const activeQuery = isSearching ? search : frequent;

  const openPortion = (food: Food) => {
    router.push({
      pathname: '/log/portion',
      params: { foodId: food.id, date, mealType },
    });
  };

  return (
    <Screen edgeToEdgeBottom>
      <View className="gap-3 px-4 pb-2 pt-3">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods"
          autoFocus
          returnKeyType="search"
          leading={<Ionicons name="search" size={18} color={colors.fgSubtle} />}
          trailing={
            query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.fgSubtle} />
              </Pressable>
            ) : null
          }
        />

        {!isSearching ? (
          <Text variant="label" tone="muted">
            Frequently logged
          </Text>
        ) : null}
      </View>

      {activeQuery.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : activeQuery.error ? (
        <ErrorState
          description={
            isApiError(activeQuery.error)
              ? activeQuery.error.userMessage
              : 'Please try again.'
          }
          onRetry={() => void activeQuery.refetch()}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={isSearching ? '🔍' : '🍽️'}
          title={isSearching ? 'No matches' : 'Nothing logged yet'}
          description={
            isSearching
              ? `We could not find anything for “${debouncedQuery.trim()}”.`
              : 'Search for a food to add your first entry.'
          }
        />
      ) : (
        <FlashList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FoodResultRow food={item} onPress={openPortion} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Only the search list is paged; the frequent list is a single page.
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (isSearching && search.hasNextPage && !search.isFetchingNextPage) {
              void search.fetchNextPage();
            }
          }}
          ListFooterComponent={
            search.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color={colors.fgSubtle} />
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function FoodResultRow({ food, onPress }: { food: Food; onPress: (food: Food) => void }) {
  const subtitle = [food.brand, `${food.per100g.calories} kcal / 100 g`]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => onPress(food)}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${subtitle}`}
      className="flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-surface-alt"
    >
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {food.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      {food.verified ? <Text className="text-xs">✅</Text> : null}
    </Pressable>
  );
}
