import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Children, Fragment, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TimePicker } from '@/components/ui/TimePicker';
import { useAuthStore } from '@/features/auth/store';
import { useDiaryDay } from '@/features/diary/queries';
import { useLogSheetStore } from '@/features/logging/store';
import { requestNotificationPermission } from '@/features/notifications/permission';
import { reconcileNotifications } from '@/features/notifications/reconcile';
import { useIsPremium, useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import type { ThemePreference } from '@/features/settings/store';
import { useTourStore } from '@/features/tour/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { getHealthProvider } from '@/lib/health';
import type { Locale } from '@/lib/i18n';
import type { TimeOfDay as MascotTime } from '@/lib/notificationScheduler';
import { ageFromBirthYear } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';

const WATER_LAG_MIN = 10;
const WATER_LAG_MAX = 50;
const WATER_LAG_STEP = 5;

const pad = (n: number) => String(n).padStart(2, '0');

export default function SettingsScreen() {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t, locale, setLocale } = useTranslation();

  const user = useProfileStore((state) => state.profile);
  const saveProfile = useProfileStore((state) => state.saveProfile);
  const eraseLocalData = useProfileStore((state) => state.eraseAll);
  const queryClient = useQueryClient();

  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const isSignedIn = session !== null;
  const isPremium = useIsPremium();

  const { data: today } = useDiaryDay(todayKey());
  const presentLogSheet = useLogSheetStore((state) => state.present);

  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const weightUnit = useSettingsStore((state) => state.weightUnit);
  const setWeightUnit = useSettingsStore((state) => state.setWeightUnit);
  const hideChallengeProgress = useSettingsStore((state) => state.hideChallengeProgress);
  const setHideChallengeProgress = useSettingsStore(
    (state) => state.setHideChallengeProgress,
  );
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const setHealthSyncEnabled = useSettingsStore((state) => state.setHealthSyncEnabled);
  const streakRemindersEnabled = useSettingsStore((state) => state.streakRemindersEnabled);
  const setStreakRemindersEnabled = useSettingsStore(
    (state) => state.setStreakRemindersEnabled,
  );

  const mascotRemindersEnabled = useSettingsStore((state) => state.mascotRemindersEnabled);
  const setMascotRemindersEnabled = useSettingsStore(
    (state) => state.setMascotRemindersEnabled,
  );
  const mascotWakeTime = useSettingsStore((state) => state.mascotWakeTime);
  const setMascotWakeTime = useSettingsStore((state) => state.setMascotWakeTime);
  const mascotSleepTime = useSettingsStore((state) => state.mascotSleepTime);
  const setMascotSleepTime = useSettingsStore((state) => state.setMascotSleepTime);
  const mascotWaterLagPct = useSettingsStore((state) => state.mascotWaterLagPct);
  const setMascotWaterLagPct = useSettingsStore((state) => state.setMascotWaterLagPct);

  const languageOptions: { value: Locale; label: string }[] = [
    { value: 'vi', label: t('profileLanguage', 'vietnamese') },
    { value: 'en', label: t('profileLanguage', 'english') },
  ];

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: t('profile', 'themeLight') },
    { value: 'dark', label: t('profile', 'themeDark') },
    { value: 'system', label: t('profile', 'themeSystem') },
  ];

  if (!user) return null;

  const genderLabel =
    user.gender === 'male'
      ? t('onboardingGender', 'male')
      : user.gender === 'female'
        ? t('onboardingGender', 'female')
        : t('onboardingGender', 'other');

  const modeLabel =
    user.calorieCalcMode === 'manual'
      ? t('targetMode', 'modeManual')
      : t('targetMode', 'modeAuto');
  const goalValue = today
    ? `${today.goal.targetKcal.toLocaleString()} kcal · ${modeLabel}`
    : modeLabel;
  const waterValue = `${(today?.goal.targetWaterMl ?? 2000).toLocaleString()} ml`;

  const handleSetLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    // A pending notification's title/body were built in the old locale —
    // re-run so the next one reflects the change.
    void reconcileNotifications(user.id);
  };

  const confirmSignOut = () => {
    Alert.alert(t('profile', 'signOut'), t('profile', 'signOutMessage'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      {
        text: t('profile', 'signOut'),
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  };

  const toggleHealthSync = async (value: boolean) => {
    if (!value) {
      setHealthSyncEnabled(false);
      return;
    }

    const granted = await getHealthProvider().requestPermissions();

    if (granted) {
      setHealthSyncEnabled(true);
    } else {
      Alert.alert(t('healthSync', 'heading'), t('healthSync', 'permissionDenied'));
    }
  };

  const toggleStreakReminders = async (value: boolean) => {
    if (!value) {
      setStreakRemindersEnabled(false);
      void reconcileNotifications(user.id);
      return;
    }

    if (await requestNotificationPermission()) {
      setStreakRemindersEnabled(true);
      void reconcileNotifications(user.id);
    } else {
      Alert.alert(
        t('notifications', 'streakRemindersHeading'),
        t('notifications', 'permissionDenied'),
      );
    }
  };

  const confirmErase = () => {
    Alert.alert(t('profile', 'eraseLocalData'), t('profile', 'eraseMessage'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      {
        text: t('profile', 'eraseConfirm'),
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          eraseLocalData();
          // Query keys aren't scoped by profile id (there's only ever one
          // active profile), so a cached result from before this erase --
          // premium tier, most visibly -- would otherwise get served to the
          // fresh profile that replaces it, since the persisted cache
          // survives eraseAll()'s SQLite wipe untouched.
          queryClient.clear();
        },
      },
    ]);
  };

  return (
    <ScrollScreen contentClassName="gap-6">
      <Stack.Screen options={{ title: t('settings', 'title') }} />

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
            {isSignedIn ? (
              <Text variant="heading" tone="brand">
                {(session.user.displayName ?? session.user.email).charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person" size={24} color={colors.brand} />
            )}
          </View>

          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text variant="heading" numberOfLines={1}>
                {isSignedIn
                  ? (session.user.displayName ?? t('profile', 'yourAccount'))
                  : t('profile', 'guest')}
              </Text>
              {isPremium ? (
                <View className="rounded-pill bg-brand px-2 py-0.5">
                  <Text variant="caption" tone="onBrand">
                    {t('common', 'premium')}
                  </Text>
                </View>
              ) : null}
            </View>
            {isSignedIn ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {session.user.email}
              </Text>
            ) : null}
          </View>
        </View>

        {isSignedIn ? null : (
          <Button
            label={t('profile', 'signInToSync')}
            onPress={() => router.push('/sign-in')}
            leading={<Ionicons name="log-in-outline" size={18} color={colors.onBrand} />}
            fullWidth
          />
        )}

        {isPremium ? null : (
          <Pressable
            onPress={() => router.push('/premium')}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-card bg-warning/15 px-3 py-3 active:opacity-70"
          >
            <Ionicons name="star" size={18} color={colors.warning} />
            <Text variant="label" tone="warning" className="flex-1">
              {t('profile', 'upgradeToPremium')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.warning} />
          </Pressable>
        )}
      </Card>

      <SettingsSection title={t('settings', 'sectionGoals')}>
        <SettingsRow
          label={t('profile', 'dailyTargets')}
          value={goalValue}
          onPress={() => router.push('/settings/goals')}
        />
        <SettingsRow
          label={t('logSheet', 'waterGoal')}
          value={waterValue}
          onPress={() => presentLogSheet('waterGoal')}
        />
        <SegmentedRow
          label={t('smartMode', 'title')}
          options={[
            { value: 'smart' as const, label: t('smartMode', 'modeSmart') },
            { value: 'all_calories' as const, label: t('smartMode', 'modeAllCalories') },
          ]}
          value={user.calorieLeftMode}
          onChange={(calorieLeftMode) => saveProfile({ calorieLeftMode })}
        />
        <SettingsRow
          label={t('smartMode', 'explainerLink')}
          onPress={() => router.push('/settings/smart-mode')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings', 'sectionBody')}>
        <SettingsRow label={t('profileBodyStats', 'sex')} value={genderLabel} />
        <SettingsRow label={t('profile', 'age')} value={`${ageFromBirthYear(user.birthYear)}`} />
        <SettingsRow label={t('profile', 'height')} value={`${user.height} cm`} />
        <SettingsRow label={t('profileBodyStats', 'weight')} value={`${user.weightCurrent} kg`} />
        <SettingsRow
          label={t('onboardingGoal', 'goalWeightLabel')}
          value={`${user.weightGoal} kg`}
        />
        <SettingsRow
          label={t('profileBodyStats', 'activity')}
          value={t('activityLevel', user.activityLevel)}
        />
        <SettingsRow label={t('profileBodyStats', 'diet')} value={t('dietType', user.dietType)} />
        <SettingsRow
          label={t('settings', 'editRow')}
          onPress={() => router.push('/settings/goals')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings', 'sectionNotifications')}>
        <SettingsRow
          label={t('notifications', 'manageReminders')}
          onPress={() => router.push('/settings/reminders')}
        />
        <SwitchRow
          label={t('notifications', 'streakRemindersHeading')}
          caption={t('notifications', 'streakRemindersCaption')}
          value={streakRemindersEnabled}
          onValueChange={(value) => void toggleStreakReminders(value)}
        />
        <SwitchRow
          label={t('settings', 'mascotReminders')}
          caption={t('settings', 'mascotRemindersHint')}
          value={mascotRemindersEnabled}
          onValueChange={setMascotRemindersEnabled}
        />
        {mascotRemindersEnabled
          ? [
              <MascotTimeRow
                key="wake"
                label={t('settings', 'mascotWakeTime')}
                value={mascotWakeTime}
                onChange={setMascotWakeTime}
                invalidMessage={t('settings', 'mascotWakeInvalid')}
              />,
              <MascotTimeRow
                key="sleep"
                label={t('settings', 'mascotSleepTime')}
                value={mascotSleepTime}
                onChange={setMascotSleepTime}
                invalidMessage={t('settings', 'mascotSleepInvalid')}
              />,
              <View key="lag" className="gap-1 py-3 pl-8 pr-4">
                <View className="flex-row items-center justify-between">
                  <Text variant="body">{t('settings', 'mascotWaterLag')}</Text>
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      onPress={() => setMascotWaterLagPct(mascotWaterLagPct - WATER_LAG_STEP)}
                      disabled={mascotWaterLagPct <= WATER_LAG_MIN}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings', 'mascotWaterLagDecrease')}
                      hitSlop={8}
                      className="h-9 w-9 items-center justify-center rounded-full bg-surface-alt active:opacity-60 disabled:opacity-40"
                    >
                      <Ionicons name="remove" size={18} color={colors.fg} />
                    </Pressable>
                    <Text variant="label" className="min-w-10 text-center">
                      {mascotWaterLagPct}%
                    </Text>
                    <Pressable
                      onPress={() => setMascotWaterLagPct(mascotWaterLagPct + WATER_LAG_STEP)}
                      disabled={mascotWaterLagPct >= WATER_LAG_MAX}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings', 'mascotWaterLagIncrease')}
                      hitSlop={8}
                      className="h-9 w-9 items-center justify-center rounded-full bg-surface-alt active:opacity-60 disabled:opacity-40"
                    >
                      <Ionicons name="add" size={18} color={colors.fg} />
                    </Pressable>
                  </View>
                </View>
                <Text variant="caption" tone="subtle">
                  {t('settings', 'mascotWaterLagHint')}
                </Text>
              </View>,
            ]
          : null}
      </SettingsSection>

      <SettingsSection title={t('profile', 'appearance')}>
        <SegmentedRow
          label={t('profileLanguage', 'heading')}
          options={languageOptions}
          value={locale}
          onChange={handleSetLocale}
        />
        <SegmentedRow
          label={t('settings', 'themeRow')}
          options={themeOptions}
          value={theme}
          onChange={setTheme}
        />
        <SegmentedRow
          label={t('profile', 'units')}
          options={[
            { value: 'kg' as const, label: t('profile', 'kilograms') },
            { value: 'lb' as const, label: t('profile', 'pounds') },
          ]}
          value={weightUnit}
          onChange={setWeightUnit}
        />
        <SettingsRow
          label={t('settings', 'ringColorsRow')}
          onPress={() => router.push('/settings/ring-colors')}
        />
        <SwitchRow
          label={t('profile', 'challengeProgress')}
          caption={t('profile', 'challengeProgressCaption')}
          value={!hideChallengeProgress}
          onValueChange={(value) => setHideChallengeProgress(!value)}
        />
      </SettingsSection>

      <SettingsSection title={t('settings', 'sectionConnections')}>
        <SwitchRow
          label={t('healthSync', 'heading')}
          caption={t('healthSync', 'caption')}
          value={healthSyncEnabled}
          onValueChange={(value) => void toggleHealthSync(value)}
        />
      </SettingsSection>

      <SettingsSection title={t('settings', 'sectionHelp')}>
        <SettingsRow
          icon="map-outline"
          label={t('tour', 'replay')}
          onPress={() => {
            useTourStore.getState().queue();
            router.back();
          }}
        />
      </SettingsSection>

      <SettingsSection title={t('settings', 'sectionAccount')}>
        {isSignedIn ? (
          <SettingsRow
            icon="log-out-outline"
            label={t('profile', 'signOut')}
            onPress={confirmSignOut}
            danger
          />
        ) : null}
        <SettingsRow
          icon="trash-outline"
          label={t('profile', 'eraseLocalData')}
          onPress={confirmErase}
          danger
        />
      </SettingsSection>
    </ScrollScreen>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const rows = Children.toArray(children);

  return (
    <View>
      <Text variant="label" tone="muted" className="mb-2 ml-1">
        {title}
      </Text>
      <Card flush className="overflow-hidden">
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View className="ml-4 h-px bg-border" /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  icon,
  onPress,
  danger = false,
}: {
  label: string;
  value?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  danger?: boolean;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const content = (
    <>
      {icon ? (
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.fgMuted} />
      ) : null}
      <Text variant="body" tone={danger ? 'danger' : 'default'} className="flex-1">
        {label}
      </Text>
      {value ? (
        <Text variant="body" tone="muted" className="max-w-[55%] shrink text-right">
          {value}
        </Text>
      ) : null}
      {onPress && !danger ? (
        <Ionicons name="chevron-forward" size={16} color={colors.fgSubtle} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-3">{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      className="min-h-[52px] flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt"
    >
      {content}
    </Pressable>
  );
}

function SwitchRow({
  label,
  caption,
  value,
  onValueChange,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className="min-h-[52px] flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1 gap-0.5">
        <Text variant="body">{label}</Text>
        {caption ? (
          <Text variant="caption" tone="subtle">
            {caption}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.brand }}
        accessibilityLabel={label}
      />
    </View>
  );
}

function SegmentedRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2 px-4 py-3">
      <Text variant="body">{label}</Text>
      <SegmentedControl options={options} value={value} onChange={onChange} />
    </View>
  );
}

function MascotTimeRow({
  label,
  value,
  onChange,
  invalidMessage,
}: {
  label: string;
  value: MascotTime;
  onChange: (time: MascotTime) => void;
  invalidMessage: string;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MascotTime | null>(null);

  const shown = draft ?? value;
  const rejected = draft !== null && (draft.hour !== value.hour || draft.minute !== value.minute);

  return (
    <View className="gap-2 py-3 pl-8 pr-4">
      <Pressable
        onPress={() => {
          setOpen(!open);
          setDraft(null);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between active:opacity-60"
      >
        <Text variant="body">{label}</Text>
        <View className="flex-row items-center gap-2">
          <Text variant="body" tone="muted">{`${pad(value.hour)}:${pad(value.minute)}`}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.fgMuted} />
        </View>
      </Pressable>

      {open ? (
        <>
          <TimePicker
            value={{ hours: shown.hour, minutes: shown.minute }}
            onChange={({ hours, minutes }) => {
              const next = { hour: hours, minute: minutes };
              setDraft(next);
              onChange(next);
            }}
          />
          {rejected ? (
            <Text variant="caption" tone="danger">
              {invalidMessage}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row gap-1 rounded-card bg-surface-alt p-1">
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => {
              haptics.selection();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            className={cn(
              // One step in from the track's `rounded-card`, matching its `p-1`
              // inset — a nested pill keeps its own radius smaller than its
              // container's, or the corners visually clash.
              'h-9 flex-1 items-center justify-center rounded-xl',
              isSelected && 'bg-surface',
            )}
          >
            <Text variant="label" tone={isSelected ? 'default' : 'muted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
