import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import type { BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodEntryRow } from '@/components/diary/FoodEntryRow';
import { TAB_BAR_CLEARANCE } from '@/components/ui/Screen';
import { SheetScrim } from '@/components/ui/SheetScrim';
import { Text } from '@/components/ui/Text';
import { foodEmojiFor } from '@/features/diary/foodEmoji';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDiaryDate, formatTime } from '@/lib/date';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

/**
 * The day's logged entries, listed in a bottom sheet.
 *
 * Opened from the dashboard "Calo đã ăn" card. Mirrors `LogSheet`'s native
 * sheet handling: an effect presents or dismisses when `open` flips, and
 * `onClose` reports a swipe-down back up. A tapped row closes the sheet and
 * routes to the entry detail.
 */
export function DayEntriesSheet({
  day,
  open,
  onClose,
}: {
  day: DiaryDay;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sheetRef = useRef<BottomSheetMethods>(null);

  // A fixed content height, so the native sheet measures the same size for
  // every day and does not grow-then-shrink when the diary day changes.
  const sheetBody = Math.round(height * 0.52);

  useEffect(() => {
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

  return (
    <>
      <SheetScrim visible={open} onPress={onClose} />
      <BottomSheet
        ref={sheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface }}
        onClose={onClose}
      >
        {/* The sheet mounts inside the tab screen, so the floating tab bar is
            drawn over its bottom edge — reserve that height, not just the
            safe area. */}
        <BottomSheetView
          style={{ width, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        >
          <View style={{ height: sheetBody }} className="gap-3 pt-3">
            <View className="h-11 flex-row items-center justify-between px-4">
              <Text variant="heading">{formatDiaryDate(day.date)}</Text>
              <Text variant="mono" tone="muted">
                {day.totals.kcal.toLocaleString()} kcal
              </Text>
            </View>

            {day.entries.length === 0 ? (
              <Text variant="body" tone="subtle" className="px-4 pb-2">
                {t('dayEntries', 'empty')}
              </Text>
            ) : (
              <ScrollView
                nestedScrollEnabled
                className="flex-1 border-t border-border"
              >
                {day.entries.map((entry) => (
                  <FoodEntryRow
                    key={entry.id}
                    entry={entry}
                    emoji={foodEmojiFor(entry)}
                    secondaryText={`${t('mealType', entry.mealType)} · ${formatTime(
                      entry.loggedAt,
                    )}`}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: '/entry/[id]',
                        params: { id: entry.id },
                      });
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}
