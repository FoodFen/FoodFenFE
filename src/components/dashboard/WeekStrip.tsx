import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
import { enUS, vi as viLocale } from 'date-fns/locale';
import { useLayoutEffect, useMemo } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useDiaryWeek } from '@/features/dashboard/queries';
import { dayRingStatus } from '@/features/dashboard/ringStatus';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import type { DateKey } from '@/lib/date';
import {
  calendarWeek,
  fromDateKey,
  isFutureDate,
  shiftDateKey,
  todayKey,
} from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { DayRing } from './DayRing';

export interface WeekStripProps {
  selected: DateKey;
  onSelect: (date: DateKey) => void;
  /** Weeks from the current one — 0 is this week, -1 last week, and so on. */
  weekOffset: number;
  onWeekOffsetChange: (updater: (offset: number) => number) => void;
}

/** Row height generous enough for the weekday initial + ring, nothing clipped. */
const STRIP_HEIGHT = 76;
/** A drag past this fraction of the screen width commits the page change. */
const SNAP_THRESHOLD = 0.28;

/**
 * A Monday–Sunday week of day rings, each showing how its calorie total landed
 * against target (see `dayRingStatus`). A slim nav row above the circles names
 * the visible range; the chevrons page whole weeks, and dragging the ring row
 * itself does the same live — the previous/next week slides in with your
 * finger and only commits past `SNAP_THRESHOLD`, snapping back otherwise, the
 * same feel as a native week-view calendar. Paging never moves the selection,
 * and forward is capped at the current week so it cannot land on the future.
 *
 * `weekOffset` is owned by the dashboard, not this component — the header's
 * "back to today" shortcut needs to reset it alongside the selected date.
 */
export function WeekStrip({
  selected,
  onSelect,
  weekOffset,
  onWeekOffsetChange,
}: WeekStripProps) {
  const { t, locale } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { width } = useWindowDimensions();

  const anchor = shiftDateKey(todayKey(), weekOffset * 7);
  const prevAnchor = shiftDateKey(anchor, -7);
  const canPageForward = weekOffset < 0;
  // Only fetched when reachable — dragging past the current week is blocked.
  const nextAnchor = canPageForward ? shiftDateKey(anchor, 7) : anchor;

  const pageBack = () => {
    haptics.selection();
    onWeekOffsetChange((o) => o - 1);
  };

  const pageForward = () => {
    onWeekOffsetChange((o) => {
      if (o >= 0) return o;
      haptics.selection();
      return o + 1;
    });
  };

  const translateX = useSharedValue(0);

  // `weekOffset` can change without ever going through the pan gesture (the
  // chevrons, or the dashboard header's "back to today" jump) — those paths
  // never reset `translateX`, so a leftover offset from an earlier drag can
  // leave the wrong pane's dates on screen. Snap back to 0 whenever the
  // visible week actually changes, regardless of what changed it.
  useLayoutEffect(() => {
    translateX.value = 0;
  }, [weekOffset, translateX]);

  // The `useLayoutEffect` above resets `translateX` once `weekOffset`
  // actually changes; these just trigger that change.
  const commitBack = pageBack;
  const commitForward = pageForward;

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      const dragged = event.translationX;
      // Right (toward history) is always draggable; left (toward today) only
      // when a next week actually exists — otherwise it just refuses to move.
      // eslint-disable-next-line react-hooks/immutability -- a worklet mutating a shared value is the standard Reanimated pattern; the rule doesn't recognize it.
      translateX.value = dragged > 0 || canPageForward ? dragged : 0;
    })
    .onEnd(() => {
      const threshold = width * SNAP_THRESHOLD;

      if (translateX.value > threshold) {
        // eslint-disable-next-line react-hooks/immutability -- see onUpdate above.
        translateX.value = withTiming(width, { duration: 220 }, (finished) => {
          if (finished) runOnJS(commitBack)();
        });
      } else if (translateX.value < -threshold && canPageForward) {
        translateX.value = withTiming(-width, { duration: 220 }, (finished) => {
          if (finished) runOnJS(commitForward)();
        });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const prevPaneStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - width }],
  }));
  const nextPaneStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + width }],
  }));

  const { data: prevWeek } = useDiaryWeek(prevAnchor);
  const { data: week } = useDiaryWeek(anchor);
  const { data: nextWeek } = useDiaryWeek(nextAnchor);

  const days = calendarWeek(anchor);
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

      <View style={{ height: STRIP_HEIGHT, overflow: 'hidden' }}>
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1 }}>
            <Animated.View
              style={[
                { position: 'absolute', width, paddingHorizontal: 16 },
                prevPaneStyle,
              ]}
            >
              <WeekDayRow
                days={calendarWeek(prevAnchor)}
                week={prevWeek}
                selected={selected}
                onSelect={onSelect}
              />
            </Animated.View>

            <Animated.View
              style={[
                { position: 'absolute', width, paddingHorizontal: 16 },
                centerStyle,
              ]}
            >
              <WeekDayRow
                days={days}
                week={week}
                selected={selected}
                onSelect={onSelect}
              />
            </Animated.View>

            <Animated.View
              style={[
                { position: 'absolute', width, paddingHorizontal: 16 },
                nextPaneStyle,
              ]}
            >
              <WeekDayRow
                days={calendarWeek(nextAnchor)}
                week={canPageForward ? nextWeek : undefined}
                selected={selected}
                onSelect={onSelect}
              />
            </Animated.View>
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

function WeekDayRow({
  days,
  week,
  selected,
  onSelect,
}: {
  days: DateKey[];
  week: DiaryDay[] | undefined;
  selected: DateKey;
  onSelect: (date: DateKey) => void;
}) {
  const byDate = useMemo(
    () => new Map((week ?? []).map((day) => [day.date, day])),
    [week],
  );

  return (
    <View className="flex-row justify-between">
      {days.map((date) => {
        const day = byDate.get(date);

        return (
          <DayRing
            key={date}
            date={date}
            status={dayRingStatus(day, { isFuture: isFutureDate(date) })}
            progress={progressFraction(day?.totals.kcal ?? 0, day?.goal.targetKcal ?? 0)}
            selected={date === selected}
            onPress={() => onSelect(date)}
          />
        );
      })}
    </View>
  );
}
