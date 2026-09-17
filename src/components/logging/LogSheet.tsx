import { BottomSheet, BottomSheetView } from '@expo/ui/community/bottom-sheet';
import type { BottomSheetMethods } from '@expo/ui/community/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SheetScrim } from '@/components/ui/SheetScrim';
import { Text } from '@/components/ui/Text';
import { WheelPicker } from '@/components/ui/WheelPicker';
import { GLASS_ML } from '@/features/dashboard/constants';
import {
  useAddWater,
  useDiaryDay,
  useLogWeight,
  useSetWaterGoal,
} from '@/features/diary/queries';
import { usePostLogInterstitial } from '@/features/gamification/queries';
import { useLogSheetStore } from '@/features/logging/store';
import { units, useSettingsStore } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

/**
 * The single log bottom sheet, mounted once at the app shell.
 *
 * Driven by `useLogSheetStore`: an effect presents or dismisses the native
 * sheet when `open` flips, and the sheet's `onClose` syncs a swipe-down back
 * into the store. The visible panel is `store.focus`, so switching panels is a
 * store update rather than local effect state. Weight and water write through
 * the existing diary mutations; the food panel is a placeholder this pass.
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

  const [weightText, setWeightText] = useState('');
  const [amountMl, setAmountMl] = useState<number>(DEFAULT_WATER_ML);
  const [error, setError] = useState<string | null>(null);

  const logWeight = useLogWeight();
  const addWater = useAddWater();
  const setWaterGoal = useSetWaterGoal();
  const finishLogging = usePostLogInterstitial();
  const { data: today } = useDiaryDay(todayKey());

  useEffect(() => {
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

  function close() {
    dismiss();
    setWeightText('');
    setAmountMl(DEFAULT_WATER_ML);
    setError(null);
  }

  function goToPanel(panel: 'weight' | 'water' | 'food') {
    setError(null);
    setFocus(panel);
  }

  function goToMenu() {
    setError(null);
    setFocus(null);
  }

  function submitWeight() {
    if (logWeight.isPending) return;

    const typed = Number(weightText.replace(',', '.'));

    if (!Number.isFinite(typed) || typed <= 0) {
      setError(t('logSheet', 'weightError'));
      return;
    }

    // Canonical storage is always kg (UC-18) — convert whatever unit the
    // device is set to before validating and saving.
    const kg = units.weightToKg(typed, weightUnit);

    if (kg > 500) {
      setError(t('logSheet', 'weightError'));
      return;
    }

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

            {focus === null ? (
              <View className="gap-2">
                <Text variant="heading">{t('logSheet', 'title')}</Text>
                <MenuRow
                  icon="body-outline"
                  label={t('logSheet', 'weight')}
                  color={colors.fgMuted}
                  onPress={() => goToPanel('weight')}
                />
                <MenuRow
                  icon="water-outline"
                  label={t('logSheet', 'water')}
                  color={colors.fgMuted}
                  onPress={() => goToPanel('water')}
                />
                <MenuRow
                  icon="restaurant-outline"
                  label={t('logSheet', 'food')}
                  color={colors.fgMuted}
                  onPress={() => goToPanel('food')}
                />
                <MenuRow
                  icon="barbell-outline"
                  label={t('logSheet', 'activity')}
                  color={colors.fgMuted}
                  onPress={() => {
                    close();
                    router.push('/log/activity');
                  }}
                />
              </View>
            ) : null}

            {focus === 'weight' ? (
              <View className="gap-3">
                <Input
                  label={t('logSheet', 'weightLabel').replace('{unit}', weightUnit)}
                  value={weightText}
                  onChangeText={setWeightText}
                  keyboardType="decimal-pad"
                  error={error ?? undefined}
                  autoFocus
                />
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

            {focus === 'food' ? (
              <View className="gap-2">
                <MenuRow
                  icon="search-outline"
                  label={t('logSheet', 'search')}
                  color={colors.fgMuted}
                  onPress={() => {
                    close();
                    router.push('/log/search');
                  }}
                />
                <MenuRow
                  icon="create-outline"
                  label={t('logSheet', 'manualEntry')}
                  color={colors.fgMuted}
                  onPress={() => {
                    close();
                    router.push('/log/manual');
                  }}
                />
              </View>
            ) : null}
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

function MenuRow({
  icon,
  label,
  color,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={cn(
        'flex-row items-center gap-3 rounded-xl border border-border bg-surface p-4',
        disabled ? 'opacity-50' : 'active:bg-surface-alt',
      )}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text variant="label" tone={disabled ? 'subtle' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}
