import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import type { BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RemoteDish } from '@/api/schemas';
import { Button } from '@/components/ui/Button';
import { TAB_BAR_CLEARANCE } from '@/components/ui/Screen';
import { SheetScrim } from '@/components/ui/SheetScrim';
import { Text } from '@/components/ui/Text';
import { MEAL_ICONS, suggestedMealType } from '@/features/diary/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';
import type { MealType } from '@/types/models';
import { MEAL_TYPES } from '@/types/models';

/**
 * Pick the meal a quick-added dish is logged under.
 *
 * Opened from the dish confirm alert's "Adjust". Mirrors `DayEntriesSheet`'s
 * native sheet handling: an effect presents or dismisses when `dish` flips
 * between set and null, and `onClose` reports a swipe-down back up. The last
 * dish is kept so the content does not blank out while the sheet slides closed.
 */
export function AddDishSheet({
  dish,
  onClose,
  onAdd,
  tabBar,
}: {
  dish: RemoteDish | null;
  onClose: () => void;
  onAdd: (mealType: MealType) => void;
  /** For screens under the floating tab bar, which draws over the sheet's bottom edge. */
  tabBar?: boolean;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sheetRef = useRef<BottomSheetMethods>(null);
  const [shown, setShown] = useState(dish);
  const [mealType, setMealType] = useState<MealType>(suggestedMealType);
  const open = dish !== null;

  if (dish && dish !== shown) {
    setShown(dish);
    setMealType(suggestedMealType());
  }

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
        <BottomSheetView
          style={{
            width,
            paddingBottom: insets.bottom + (tabBar ? TAB_BAR_CLEARANCE : 16),
          }}
        >
          <View className="gap-4 px-4 pt-3">
            <Text variant="heading">{t('dishes', 'adjustTitle')}</Text>

            {shown ? (
              <View className="flex-row items-center justify-between gap-3">
                <Text variant="body" className="flex-1" numberOfLines={2}>
                  {shown.name}
                </Text>
                {/* Whole kcal for display only. */}
                <Text variant="mono" tone="muted">
                  {Math.round(shown.kcal)} kcal
                </Text>
              </View>
            ) : null}

            <View className="flex-row gap-2">
              {MEAL_TYPES.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    haptics.selection();
                    setMealType(m);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mealType === m }}
                  className={cn(
                    'flex-1 items-center gap-0.5 rounded-card border py-2',
                    mealType === m
                      ? 'border-brand bg-brand-soft'
                      : 'border-border bg-surface',
                  )}
                >
                  <Ionicons
                    name={MEAL_ICONS[m]}
                    size={18}
                    color={mealType === m ? colors.brand : colors.fgMuted}
                  />
                  <Text variant="caption" tone={mealType === m ? 'brand' : 'muted'}>
                    {t('mealType', m)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button label={t('dishes', 'confirmAdd')} onPress={() => onAdd(mealType)} />
          </View>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}
