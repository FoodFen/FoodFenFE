import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NumberField } from '@/components/ui/NumberField';
import { Text } from '@/components/ui/Text';
import { TimePicker } from '@/components/ui/TimePicker';
import type { TimeOfDay } from '@/components/ui/TimePicker';
import { useLogActivity } from '@/features/diary/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { ACTIVITY_PRESETS, caloriesBurnedForPreset } from '@/lib/activity';
import type { ActivityPreset } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { todayKey, withTime } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/**
 * Log a workout manually, from a preset list (UC-16).
 *
 * Picking a preset opens a duration + time step, mirroring the
 * search-a-food → pick-a-portion flow in `app/log/search.tsx`. The free-text
 * path is a disabled affordance only — it needs the same AI backend the app
 * doesn't have yet, so it stays inert like `logManual`'s "smart entry" row.
 */

const DURATION_PRESETS_MIN = [15, 30, 45, 60, 90] as const;

export default function ActivityScreen() {
  const [selected, setSelected] = useState<ActivityPreset | null>(null);

  if (selected) {
    return <DurationStep preset={selected} onBack={() => setSelected(null)} />;
  }

  return <ActivityListScreen onSelect={setSelected} />;
}

function ActivityListScreen({
  onSelect,
}: {
  onSelect: (preset: ActivityPreset) => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className="flex-1 bg-bg">
      <View className="px-4 pt-3">
        <Text variant="label" tone="muted">
          {t('logActivity', 'presetHeading')}
        </Text>
      </View>

      <View className="pt-1">
        {ACTIVITY_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            onPress={() => {
              haptics.selection();
              onSelect(preset);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('logActivity', 'pickPresetA11y')
              .replace('{name}', t('activityPresets', preset.id))
              .replace('{kcal}', String(preset.kcalPer30Min))}
            className="flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-surface-alt"
          >
            <Ionicons
              name={preset.icon as keyof typeof Ionicons.glyphMap}
              size={22}
              color={colors.fgMuted}
            />
            <View className="flex-1 gap-0.5">
              <Text variant="body">{t('activityPresets', preset.id)}</Text>
              <Text variant="caption" tone="muted">
                {t('logActivity', 'kcalPer30Min').replace(
                  '{kcal}',
                  String(preset.kcalPer30Min),
                )}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.fgSubtle} />
          </Pressable>
        ))}
      </View>

      <Pressable
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        className="mx-4 mt-4 flex-row items-center gap-2 opacity-40"
      >
        <Ionicons name="sparkles-outline" size={16} color={colors.fgSubtle} />
        <Text variant="caption" tone="subtle" className="flex-1">
          {t('logActivity', 'freeTextLabel')}
        </Text>
        <Text variant="caption" tone="subtle">
          {t('logManual', 'comingSoon')}
        </Text>
      </Pressable>
    </View>
  );
}

function DurationStep({
  preset,
  onBack,
}: {
  preset: ActivityPreset;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const logActivity = useLogActivity();

  const [duration, setDuration] = useState(30);
  const [useNow, setUseNow] = useState(true);
  const [time, setTime] = useState<TimeOfDay>(() => {
    const now = new Date();
    return { hours: now.getHours(), minutes: Math.floor(now.getMinutes() / 5) * 5 };
  });

  const kcal = caloriesBurnedForPreset(preset, duration);

  const save = () => {
    const loggedAt = useNow ? undefined : withTime(todayKey(), time.hours, time.minutes);

    logActivity.mutate(
      { activityType: preset.id, caloriesBurned: kcal, date: todayKey(), loggedAt },
      {
        onSuccess: () => {
          haptics.success();
          router.dismissAll();
        },
        onError: (error) => {
          haptics.error();
          Alert.alert(
            t('logActivity', 'saveErrorTitle'),
            error instanceof Error ? error.message : t('logMeal', 'saveErrorFallback'),
          );
        },
      },
    );
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common', 'back')}
              style={{ paddingRight: 16 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.fg} />
            </Pressable>
          ),
        }}
      />

      <Text variant="title">{t('activityPresets', preset.id)}</Text>

      <Card className="gap-4">
        <View className="gap-2">
          <Text variant="label" tone="muted">
            {t('logActivity', 'durationLabel')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {DURATION_PRESETS_MIN.map((minutes) => {
              const isSelected = minutes === duration;

              return (
                <Pressable
                  key={minutes}
                  onPress={() => {
                    haptics.selection();
                    setDuration(minutes);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'h-10 justify-center rounded-pill border px-4',
                    isSelected ? 'border-brand bg-brand' : 'border-border bg-surface',
                  )}
                >
                  <Text variant="label" tone={isSelected ? 'onBrand' : 'default'}>
                    {minutes}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="muted">
              {t('logActivity', 'customMinutes')}
            </Text>
            <NumberField
              compact
              label={t('logActivity', 'customMinutes')}
              value={duration}
              onChange={(next) => setDuration(next ?? duration)}
              min={1}
              max={600}
              precision={0}
            />
          </View>
        </View>

        <View className="gap-2 border-t border-border pt-3">
          <Text variant="label" tone="muted">
            {t('logActivity', 'timeLabel')}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                haptics.selection();
                setUseNow(true);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: useNow }}
              className={cn(
                'h-10 flex-1 items-center justify-center rounded-pill border',
                useNow ? 'border-brand bg-brand' : 'border-border bg-surface',
              )}
            >
              <Text variant="label" tone={useNow ? 'onBrand' : 'default'}>
                {t('logActivity', 'now')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptics.selection();
                setUseNow(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: !useNow }}
              className={cn(
                'h-10 flex-1 items-center justify-center rounded-pill border',
                !useNow ? 'border-brand bg-brand' : 'border-border bg-surface',
              )}
            >
              <Text variant="label" tone={!useNow ? 'onBrand' : 'default'}>
                {t('logActivity', 'pickTime')}
              </Text>
            </Pressable>
          </View>
          {!useNow ? <TimePicker value={time} onChange={setTime} /> : null}
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-baseline justify-between">
          <Text variant="heading">{t('dashboard', 'caloriesBurned')}</Text>
          <Text variant="title">{kcal.toLocaleString()}</Text>
        </View>
      </Card>

      <Button
        label={t('logActivity', 'save')}
        onPress={save}
        loading={logActivity.isPending}
        disabled={duration <= 0}
        fullWidth
        size="lg"
      />
    </KeyboardAwareScrollView>
  );
}
