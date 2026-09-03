import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isApiError } from '@/api/errors';
import { CalorieSummaryCard } from '@/components/diary/CalorieSummaryCard';
import { DateStrip } from '@/components/diary/DateStrip';
import { MealSection } from '@/components/diary/MealSection';
import { ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { DiaryDaySkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { useDeleteEntry, useDiaryDay } from '@/features/diary/queries';
import { emptyDiaryDay, groupByMeal } from '@/features/diary/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatDiaryDate, todayKey } from '@/lib/date';
import type { DateKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { calculateGoals } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { FoodEntry, MealType } from '@/types/models';

/** The Today screen: the day's totals and its four meals. */
export default function DiaryScreen() {
  const [selectedDate, setSelectedDate] = useState<DateKey>(todayKey());
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const user = useAuthStore((state) => state.session?.user);
  const { data, isPending, isRefetching, error, refetch } = useDiaryDay(selectedDate);
  const deleteEntry = useDeleteEntry();

  /**
   * Fall back to a locally computed empty day so the ring and the meal
   * sections render immediately on a date that has never been fetched, rather
   * than showing a spinner over an otherwise usable screen.
   */
  const day =
    data ?? (user ? emptyDiaryDay(selectedDate, calculateGoals(user)) : undefined);

  const handleAddFood = useCallback(
    (mealType: MealType) => {
      router.push({
        pathname: '/log/search',
        params: { date: selectedDate, mealType },
      });
    },
    [selectedDate],
  );

  const handleLongPressEntry = useCallback(
    (entry: FoodEntry) => {
      haptics.impact();

      Alert.alert(entry.food.name, 'Remove this entry from your diary?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEntry.mutate(
              { id: entry.id, date: selectedDate },
              {
                onError: (mutationError) => {
                  Alert.alert(
                    'Could not delete',
                    isApiError(mutationError)
                      ? mutationError.userMessage
                      : 'Please try again.',
                  );
                },
              },
            );
          },
        },
      ]);
    },
    [deleteEntry, selectedDate],
  );

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }} className="gap-3 bg-bg pb-3">
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Text variant="title">{formatDiaryDate(selectedDate)}</Text>

          <Pressable
            onPress={() => {
              haptics.selection();
              setSelectedDate(todayKey());
            }}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-alt"
          >
            <Ionicons name="today-outline" size={22} color={colors.fgMuted} />
          </Pressable>
        </View>

        <DateStrip selected={selectedDate} onSelect={setSelectedDate} />
      </View>

      {isPending && !day ? (
        <View className="px-4">
          <DiaryDaySkeleton />
        </View>
      ) : error && !data ? (
        <ErrorState
          description={isApiError(error) ? error.userMessage : 'Please try again.'}
          onRetry={() => void refetch()}
        />
      ) : day ? (
        <ScrollScreen
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.fgMuted}
            />
          }
        >
          <CalorieSummaryCard day={day} />

          {groupByMeal(day.entries).map((group) => (
            <MealSection
              key={group.mealType}
              group={group}
              onAddFood={handleAddFood}
              onPressEntry={(entry) => router.push(`/food/${entry.food.id}`)}
              onLongPressEntry={handleLongPressEntry}
            />
          ))}
        </ScrollScreen>
      ) : null}
    </Screen>
  );
}
