import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalorieSummaryCard } from '@/components/diary/CalorieSummaryCard';
import { DateStrip } from '@/components/diary/DateStrip';
import { MealSection } from '@/components/diary/MealSection';
import { WaterCard } from '@/components/diary/WaterCard';
import { ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { DiaryDaySkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDeleteEntry, useDiaryDay } from '@/features/diary/queries';
import { groupByMeal } from '@/features/diary/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { formatDiaryDate, todayKey } from '@/lib/date';
import type { DateKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';
import type { FoodEntry, MealType } from '@/types/models';

/** The Today screen: the day's totals, its four meals, and water. */
export default function DiaryScreen() {
  const [selectedDate, setSelectedDate] = useState<DateKey>(todayKey());
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const {
    data: day,
    isPending,
    isRefetching,
    error,
    refetch,
  } = useDiaryDay(selectedDate);
  const deleteEntry = useDeleteEntry();

  const handleAddMeal = useCallback(
    (mealType: MealType) => {
      router.push({
        pathname: '/log/meal',
        params: { date: selectedDate, mealType },
      });
    },
    [selectedDate],
  );

  const handleLongPressEntry = useCallback(
    (entry: FoodEntry) => {
      haptics.impact();

      Alert.alert(entry.name, 'Remove this meal from your diary?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEntry.mutate(
              { id: entry.id },
              {
                onError: () => Alert.alert('Could not delete', 'Please try again.'),
              },
            );
          },
        },
      ]);
    },
    [deleteEntry],
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

      {isPending ? (
        <View className="px-4">
          <DiaryDaySkeleton />
        </View>
      ) : error || !day ? (
        <ErrorState
          description={
            error instanceof Error ? error.message : 'That day could not be loaded.'
          }
          onRetry={() => void refetch()}
        />
      ) : (
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
              onAddMeal={handleAddMeal}
              onPressEntry={(entry) => router.push(`/entry/${entry.id}`)}
              onLongPressEntry={handleLongPressEntry}
            />
          ))}

          <WaterCard
            date={selectedDate}
            waterMl={day.waterMl}
            targetMl={day.goal.targetWaterMl}
          />
        </ScrollScreen>
      )}
    </Screen>
  );
}
