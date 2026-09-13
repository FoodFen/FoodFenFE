import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
import { enUS, vi as viLocale } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Text } from '@/components/ui/Text';
import { useDiaryWeek } from '@/features/dashboard/queries';
import { dayRingStatus } from '@/features/dashboard/ringStatus';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import type { DateKey } from '@/lib/date';
import { calendarWeek, fromDateKey, isFutureDate, shiftDateKey, todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';

import { DayRing } from './DayRing';

export interface WeekStripProps {
  selected: DateKey;
  onSelect: (date: DateKey) => void;
}

/**
 * A Monday–Sunday week of day rings, each showing how its calorie total landed
 * against target (see `dayRingStatus`). A slim nav row above the circles pages
 * whole weeks back through history and names the visible range; paging never
 * moves the selection, and the forward chevron is disabled on the current week
 * so it cannot land on an all-future week.
 */
export function WeekStrip({ selected, onSelect }: WeekStripProps) {
  const { t, locale } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const [weekOffset, setWeekOffset] = useState(0);
  const anchor = shiftDateKey(todayKey(), weekOffset * 7);
  const canPageForward = weekOffset < 0;

  const pageBack = () => {
    haptics.selection();
    setWeekOffset((o) => o - 1);
  };

  const pageForward = () => {
    setWeekOffset((o) => {
      if (o >= 0) return o;
      haptics.selection();
      return o + 1;
    });
  };

  // Swipe the strip the same way the chevrons page it: flick left to move
  // toward today, flick right to move back through history.
  const swipe = Gesture.Race(
    Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onEnd(pageForward),
    Gesture.Fling().direction(Directions.RIGHT).runOnJS(true).onEnd(pageBack),
  );

  const { data: week } = useDiaryWeek(anchor);
  const days = calendarWeek(anchor);
  const today = todayKey();

  const byDate = useMemo(
    () => new Map((week ?? []).map((day) => [day.date, day])),
    [week],
  );

  const dfnsLocale = locale === 'vi' ? viLocale : enUS;
  const rangeLabel = `${format(fromDateKey(days[0] ?? anchor), 'd MMM', {
    locale: dfnsLocale,
  })} – ${format(fromDateKey(days[6] ?? anchor), 'd MMM', { locale: dfnsLocale })}`;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-center gap-3">
        <Pressable
          onPress={pageBack}
          accessibilityRole="button"
          accessibilityLabel={t('weekStrip', 'previousWeek')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name="chevron-back" size={20} color={colors.fgMuted} />
        </Pressable>

        <Text variant="label" tone="muted">
          {rangeLabel}
        </Text>

        <Pressable
          onPress={pageForward}
          disabled={!canPageForward}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPageForward }}
          accessibilityLabel={t('weekStrip', 'nextWeek')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={canPageForward ? colors.fgMuted : colors.fgSubtle}
          />
        </Pressable>
      </View>

      <GestureDetector gesture={swipe}>
        <View className="flex-row justify-between px-4">
          {days.map((date) => {
            const day = byDate.get(date);

            return (
              <DayRing
                key={date}
                date={date}
                status={dayRingStatus(day, { isFuture: isFutureDate(date) })}
                progress={progressFraction(day?.totals.kcal ?? 0, day?.goal.targetKcal ?? 0)}
                selected={date === selected}
                isToday={date === today}
                onPress={() => onSelect(date)}
              />
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}
