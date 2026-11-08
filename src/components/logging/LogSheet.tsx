import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import type { BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeightWheels } from '@/components/logging/WeightWheels';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { SheetScrim } from '@/components/ui/SheetScrim';
import { Text } from '@/components/ui/Text';
import { WheelPicker } from '@/components/ui/WheelPicker';
import { GLASS_ML } from '@/features/dashboard/constants';
import { useWeightAsOf } from '@/features/dashboard/queries';
import {
  useAddWater,
  useDiaryDay,
  useLogWeight,
  useSetWaterGoal,
} from '@/features/diary/queries';
import { usePostLogInterstitial } from '@/features/gamification/queries';
import { useLogSheetStore } from '@/features/logging/store';
import { useProfileStore } from '@/features/profile/store';
import { units, useSettingsStore } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

/**
 * The single log bottom sheet, mounted once at the app shell.
 *
 * Driven by `useLogSheetStore`: an effect presents or dismisses the native
 * sheet when `open` flips, and the sheet's `onClose` syncs a swipe-down back
 * into the store. The visible panel is `store.focus`, so switching panels is a
 * store update rather than local effect state. The menu is food-first (snap / describe / search tiles, then
 * secondary water / weight / activity / manual buttons); weight and water write
 * through the existing diary mutations.
 */

const DEFAULT_WATER_ML = GLASS_ML;
/** 50–2000 ml, 50 ml steps — a precise custom amount for one drink. */
const WATER_AMOUNT_OPTIONS = Array.from({ length: 40 }, (_, i) => {
  const ml = (i + 1) * 50;
  return { value: ml, label: String(ml) };
});
/** 500–5000 ml, 250 ml steps — matches the cup grid's own granularity. */
const WATER_GOAL_OPTIONS = Array.from({ length: 19 }, (_, i) => {
  const ml = 500 + i * 250;
  return { value: ml, label: String(ml) };
});

export function LogSheet() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const open = useLogSheetStore((state) => state.open);
  const focus = useLogSheetStore((state) => state.focus);
  const setFocus = useLogSheetStore((state) => state.setFocus);
  const dismiss = useLogSheetStore((state) => state.dismiss);
  const weightUnit = useSettingsStore((state) => state.weightUnit);

  const sheetRef = useRef<BottomSheetMethods>(null);

  const [weightTenths, setWeightTenths] = useState<number | null>(null);
  const [amountMl, setAmountMl] = useState<number>(DEFAULT_WATER_ML);
  const [error, setError] = useState<string | null>(null);

  const logWeight = useLogWeight();
  const addWater = useAddWater();
  const setWaterGoal = useSetWaterGoal();
  const finishLogging = usePostLogInterstitial('water');
  const { data: today } = useDiaryDay(todayKey());
  const { data: lastWeight } = useWeightAsOf(todayKey());
  const profileWeightKg = useProfileStore((state) => state.profile?.weightCurrent);

  const startKg = lastWeight?.weight ?? profileWeightKg ?? 60;
  const shownTenths =
    weightTenths ?? Math.round(units.weightFromKg(startKg, weightUnit) * 10);

  useEffect(() => {
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

  function close() {
    dismiss();
    setWeightTenths(null);
    setAmountMl(DEFAULT_WATER_ML);
    setError(null);
  }

  function goToPanel(panel: 'weight' | 'water') {
    setError(null);
    setFocus(panel);
  }

  function goToMenu() {
    setError(null);
    setFocus(null);
  }

  function submitWeight() {
    if (logWeight.isPending) return;

    // Canonical storage is always kg (UC-18) — convert whatever unit the
    // device is set to before saving.
    const kg = units.weightToKg(shownTenths / 10, weightUnit);

    logWeight.mutate(
      { weight: kg, date: todayKey() },
      { onSuccess: close, onError: () => setError(t('auth', 'genericError')) },
    );
  }

  function submitWater() {
    if (addWater.isPending) return;

    addWater.mutate(
      { amountMl, date: todayKey() },
      {
        onSuccess: () => {
          close();
          finishLogging();
        },
        onError: () => setError(t('auth', 'genericError')),
      },
    );
  }

  function submitWaterGoal(targetMl: number) {
    if (setWaterGoal.isPending) return;

    setWaterGoal.mutate(targetMl, {
      onSuccess: close,
      onError: () => setError(t('auth', 'genericError')),
    });
  }

  return (
    <>
      <SheetScrim visible={open} onPress={close} />
      <BottomSheet
        ref={sheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.surface }}
        onClose={close}
      >
        <BottomSheetView style={{ width, paddingBottom: insets.bottom + 16 }}>
          <View className="gap-4 p-4">
            {focus !== null ? (
              <View className="flex-row items-center gap-1">
                <Pressable
                  onPress={goToMenu}
                  accessibilityRole="button"
                  accessibilityLabel={t('common', 'back')}
                  hitSlop={8}
                  className="-ml-1 p-1"
                >
                  <Ionicons name="chevron-back" size={22} color={colors.fgMuted} />
                </Pressable>
                <Text variant="heading">{t('logSheet', focus)}</Text>
              </View>
            ) : null}

            <Animated.View key={focus ?? 'menu'} entering={FadeIn.duration(200)}>
              {focus === null ? (
                <View className="gap-3">
                  <Text variant="heading">{t('logSheet', 'title')}</Text>
                  <View className="flex-row gap-3">
                    <PrimaryTile
                      icon="camera"
                      label={t('logSheet', 'snap')}
                      color={colors.brand}
                      emphasized
                      onPress={() => {
                        close();
                        router.push('/log/manual?mode=image');
                      }}
                    />
                    <PrimaryTile
                      icon="sparkles"
                      label={t('logSheet', 'describe')}
                      color={colors.brand}
                      onPress={() => {
                        close();
                        router.push('/log/manual?mode=describe');
                      }}
                    />
                    <PrimaryTile
                      icon="search"
                      label={t('logSheet', 'searchFood')}
                      color={colors.brand}
                      onPress={() => {
                        close();
                        router.push('/log/search');
                      }}
                    />
                  </View>
                  <Text variant="caption" tone="muted" className="mt-1">
                    {t('logSheet', 'other')}
                  </Text>
                  <View className="flex-row">
                    <SecondaryButton
                      icon="water-outline"
                      label={t('logSheet', 'waterShort')}
                      color={colors.fat}
                      onPress={() => goToPanel('water')}
                    />
                    <SecondaryButton
                      icon="body-outline"
                      label={t('logSheet', 'weightShort')}
                      color={colors.carbs}
                      onPress={() => goToPanel('weight')}
                    />
                    <SecondaryButton
                      icon="barbell-outline"
                      label={t('logSheet', 'activityShort')}
                      color={colors.protein}
                      onPress={() => {
                        close();
                        router.push('/log/activity');
                      }}
                    />
                    <SecondaryButton
                      icon="create-outline"
                      label={t('logSheet', 'manualShort')}
                      color={colors.fgMuted}
                      onPress={() => {
                        close();
                        router.push('/log/manual');
                      }}
                    />
                  </View>
                </View>
              ) : null}

              {focus === 'weight' ? (
                <View className="items-center gap-3">
                  <Text variant="label" tone="muted">
                    {t('logSheet', 'weightLabel').replace('{unit}', weightUnit)}
                  </Text>
                  <WeightWheels
                    unit={weightUnit}
                    tenths={shownTenths}
                    onChange={setWeightTenths}
                  />
                  {error ? (
                    <Text variant="caption" tone="danger">
                      {error}
                    </Text>
                  ) : null}
                  <Button
                    label={t('logSheet', 'save')}
                    onPress={submitWeight}
                    loading={logWeight.isPending}
                    fullWidth
                  />
                </View>
              ) : null}

              {focus === 'water' ? (
                <View className="items-center gap-3">
                  <Text variant="label" tone="muted">
                    {t('logSheet', 'waterLabel')}
                  </Text>
                  <WheelPicker
                    data={WATER_AMOUNT_OPTIONS}
                    value={amountMl}
                    onChange={setAmountMl}
                    sideLabel=" ml"
                  />
                  {error ? (
                    <Text variant="caption" tone="danger">
                      {error}
                    </Text>
                  ) : null}
                  <Button
                    label={t('logSheet', 'save')}
                    onPress={submitWater}
                    loading={addWater.isPending}
                    fullWidth
                  />
                </View>
              ) : null}

              {focus === 'waterGoal' ? (
                <WaterGoalPanel
                  initialMl={today?.goal.targetWaterMl ?? 2000}
                  error={error}
                  isPending={setWaterGoal.isPending}
                  onSave={submitWaterGoal}
                />
              ) : null}
            </Animated.View>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
}

/**
 * The water-goal wheel, split out so its draft value can initialize straight
 * from `initialMl` (a prop) rather than a `useEffect` writing state after
 * mount — the panel only exists in the tree while `focus === 'waterGoal'`, so
 * each open is a fresh mount with the current target already in hand.
 */
function WaterGoalPanel({
  initialMl,
  error,
  isPending,
  onSave,
}: {
  initialMl: number;
  error: string | null;
  isPending: boolean;
  onSave: (goalMl: number) => void;
}) {
  const { t } = useTranslation();
  const [goalMl, setGoalMl] = useState(initialMl);

  return (
    <View className="items-center gap-3">
      <Text variant="label" tone="muted">
        {t('logSheet', 'waterGoalLabel')}
      </Text>
      <WheelPicker
        data={WATER_GOAL_OPTIONS}
        value={goalMl}
        onChange={setGoalMl}
        sideLabel=" ml"
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label={t('logSheet', 'save')}
        onPress={() => onSave(goalMl)}
        loading={isPending}
        fullWidth
      />
    </View>
  );
}

// Palette hexes are #RRGGBB; "26" is ~15% alpha.
const ICON_FILL_ALPHA = '26';

function PrimaryTile({
  icon,
  label,
  color,
  emphasized,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  emphasized?: boolean;
  onPress: () => void;
}) {
  const { resolved } = useAppTheme();
  const { onBrand } = colorsFor(resolved);

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-28 flex-1 items-center justify-center gap-2 rounded-card ${
        emphasized ? 'bg-brand' : 'bg-surface-alt'
      }`}
    >
      {emphasized ? (
        <Ionicons name={icon} size={32} color={onBrand} />
      ) : (
        <View
          style={{ backgroundColor: `${color}${ICON_FILL_ALPHA}` }}
          className="h-12 w-12 items-center justify-center rounded-pill"
        >
          <Ionicons name={icon} size={26} color={color} />
        </View>
      )}
      <Text variant="label" tone={emphasized ? 'onBrand' : 'default'}>
        {label}
      </Text>
    </PressableScale>
  );
}

function SecondaryButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 items-center gap-1"
    >
      <View
        style={{ backgroundColor: `${color}${ICON_FILL_ALPHA}` }}
        className="h-12 w-12 items-center justify-center rounded-pill"
      >
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}
