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
import { Screen, ScrollScreen, TAB_BAR_CLEARANCE } from '@/components/ui/Screen';
import { DiaryDaySkeleton } from '@/components/ui/Skeleton';
import { MissingGoalError } from '@/data/diaryRepository';
import { useDiaryDay, useHealMissingGoal } from '@/features/diary/queries';
import { useProfileStore } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const isToday = selectedDate === todayKey();
  const backToToday = () => {
    setSelectedDate(todayKey());
    setWeekOffset(0);
  };

  const { data: day, isPending, isRefetching, error, refetch } = useDiaryDay(selectedDate);

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
        <DashboardHeader isToday={isToday} onBackToToday={backToToday} />
        <WeekStrip
          selected={selectedDate}
          onSelect={setSelectedDate}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
        />
      </View>

      {isPending ? (
        <View className="px-4" style={{ paddingBottom: TAB_BAR_CLEARANCE }}>
          <DiaryDaySkeleton />
        </View>
      ) : error || !day ? (
        <View style={{ paddingBottom: TAB_BAR_CLEARANCE }}>
          <ErrorState
            description={
              error instanceof Error ? error.message : t('dashboard', 'dayLoadError')
            }
            onRetry={() => {
              resetHeal();
              void refetch();
            }}
          />
        </View>
      ) : (
        <ScrollScreen
          tabBar
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
