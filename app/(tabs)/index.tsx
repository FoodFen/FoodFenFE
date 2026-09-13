import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaloriesBurnedSection } from '@/components/dashboard/CaloriesBurnedSection';
import { CaloriesEatenSection } from '@/components/dashboard/CaloriesEatenSection';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DayEntriesSheet } from '@/components/dashboard/DayEntriesSheet';
import { FiberSection } from '@/components/dashboard/FiberSection';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { WaterSection } from '@/components/dashboard/WaterSection';
import { WeekStrip } from '@/components/dashboard/WeekStrip';
import { WeightSection } from '@/components/dashboard/WeightSection';
import { ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { DiaryDaySkeleton } from '@/components/ui/Skeleton';
import { MissingGoalError } from '@/data/diaryRepository';
import { useDiaryDay, useHealMissingGoal } from '@/features/diary/queries';
import { useProfileStore } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { todayKey } from '@/lib/date';
import type { DateKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

/**
 * The dashboard: the header, the week strip, a summary pager, and the stacked
 * metric sections. Logging happens from the floating action button in the tab
 * bar, not from here — the section "+" buttons are inert this pass.
 */
export default function DashboardScreen() {
  const [selectedDate, setSelectedDate] = useState<DateKey>(todayKey());
  const [entriesOpen, setEntriesOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const { data: day, isPending, isRefetching, error, refetch } = useDiaryDay(selectedDate);

  // Self-heal the one edge case where a profile exists but its goal row does
  // not: recompute it from the profile, which invalidates and lets the day
  // query succeed on retry. Fires once per idle state — a failed heal falls
  // through to the error card, whose Retry resets it so it can try again.
  const profile = useProfileStore((state) => state.profile);
  const { mutate: healGoal, reset: resetHeal, isIdle: healIsIdle } = useHealMissingGoal();

  useEffect(() => {
    if (error instanceof MissingGoalError && profile && healIsIdle) {
      healGoal();
    }
  }, [error, profile, healIsIdle, healGoal]);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top }} className="gap-3 bg-bg pb-3">
        <DashboardHeader />
        <WeekStrip selected={selectedDate} onSelect={setSelectedDate} />
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
          onRetry={() => {
            resetHeal();
            void refetch();
          }}
        />
      ) : (
        <ScrollScreen
          bottomSpacing={96}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.fgMuted}
            />
          }
        >
          <SummaryCard day={day} />
          <CaloriesEatenSection day={day} onOpenEntries={() => setEntriesOpen(true)} />
          <CaloriesBurnedSection day={day} />
          <WaterSection day={day} />
          <FiberSection day={day} />
          <WeightSection day={day} />
        </ScrollScreen>
      )}

      {day ? (
        <DayEntriesSheet
          day={day}
          open={entriesOpen}
          onClose={() => setEntriesOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
