import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { useDiaryDay, usePendingChanges } from '@/features/diary/queries';
import { useLogSheetStore } from '@/features/logging/store';
import { useIsPremium, useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import type { ThemePreference } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { getHealthProvider } from '@/lib/health';
import type { Locale } from '@/lib/i18n';
import { ageFromBirthYear, totalDailyEnergyExpenditure } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';

export default function SettingsScreen() {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t, locale, setLocale } = useTranslation();

  const user = useProfileStore((state) => state.profile);
  const saveProfile = useProfileStore((state) => state.saveProfile);
  const eraseLocalData = useProfileStore((state) => state.eraseAll);

  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const isSignedIn = session !== null;
  const isPremium = useIsPremium();

  const { data: pendingChanges = 0 } = usePendingChanges();
  const { data: today } = useDiaryDay(todayKey());
  const presentLogSheet = useLogSheetStore((state) => state.present);

  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const weightUnit = useSettingsStore((state) => state.weightUnit);
  const setWeightUnit = useSettingsStore((state) => state.setWeightUnit);
  const devSeedEnabled = useSettingsStore((state) => state.devSeedEnabled);
  const setDevSeedEnabled = useSettingsStore((state) => state.setDevSeedEnabled);
  const hideChallengeProgress = useSettingsStore((state) => state.hideChallengeProgress);
  const setHideChallengeProgress = useSettingsStore(
    (state) => state.setHideChallengeProgress,
  );
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const setHealthSyncEnabled = useSettingsStore((state) => state.setHealthSyncEnabled);

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

  const maintenance = Math.round(totalDailyEnergyExpenditure(user));

  const genderLabel =
    user.gender === 'male'
      ? t('onboardingGender', 'male')
      : user.gender === 'female'
        ? t('onboardingGender', 'female')
        : t('onboardingGender', 'other');

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

  const confirmErase = () => {
    Alert.alert(t('profile', 'eraseLocalData'), t('profile', 'eraseMessage'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      {
        text: t('profile', 'eraseConfirm'),
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          eraseLocalData();
        },
      },
    ]);
  };

  return (
    <ScrollScreen>
      <Stack.Screen options={{ title: t('settings', 'title') }} />

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
            <Text variant="heading" tone="brand">
              {(session?.user.displayName ?? session?.user.email ?? 'G')
                .charAt(0)
                .toUpperCase()}
            </Text>
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
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {isSignedIn ? session.user.email : t('profile', 'trackingOffline')}
            </Text>
          </View>
        </View>

        {isSignedIn ? null : (
          <View className="gap-2 border-t border-border pt-3">
            <Pressable
              onPress={() => router.push('/sign-in')}
              accessibilityRole="button"
              className="flex-row items-center justify-between active:opacity-60"
            >
              <Text variant="label" tone="brand">
                {t('profile', 'signInToSync')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand} />
            </Pressable>
            <Text variant="caption" tone="subtle">
              {t('profile', 'offlineNotice')}
            </Text>
          </View>
        )}

        {isPremium ? null : (
          <Pressable
            onPress={() => router.push('/premium')}
            accessibilityRole="button"
            className="flex-row items-center justify-between border-t border-border pt-3 active:opacity-60"
          >
            <Text variant="label" tone="warning">
              {t('profile', 'upgradeToPremium')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.warning} />
          </Pressable>
        )}

        {pendingChanges > 0 ? (
          <View className="flex-row items-center gap-2 border-t border-border pt-3">
            <Ionicons name="cloud-offline-outline" size={16} color={colors.fgMuted} />
            <Text variant="caption" tone="muted">
              {pendingChanges} {t('profile', pendingChanges === 1 ? 'change' : 'changes')}{' '}
              {t('profile', 'savedOnDeviceOnly')}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('profile', 'dailyTargets')}</Text>

        <Pressable
          onPress={() => router.push('/settings/goals')}
          accessibilityRole="button"
          className="flex-row items-center justify-between active:opacity-60"
        >
          <Text variant="label" tone="brand">
            {t('profile', 'editGoals')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brand} />
        </Pressable>

        <Text variant="caption" tone="subtle">
          {user.calorieCalcMode === 'manual'
            ? t('profile', 'targetsManual')
            : t('profile', 'targetsAuto').replace('{kcal}', maintenance.toLocaleString())}
        </Text>

        <View className="flex-row items-center justify-between border-t border-border pt-3">
          <View className="gap-0.5">
            <Text variant="label">{t('targetMode', 'title')}</Text>
            <Text variant="caption" tone="muted">
              {user.calorieCalcMode === 'manual'
                ? t('targetMode', 'modeManual')
                : t('targetMode', 'modeAuto')}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/settings/goals')}
            accessibilityRole="button"
            accessibilityLabel={t('profile', 'editGoals')}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt"
          >
            <Ionicons name="pencil" size={16} color={colors.fgMuted} />
          </Pressable>
        </View>

        <View className="gap-1 border-t border-border pt-3">
          <Pressable
            onPress={() => presentLogSheet('waterGoal')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard', 'editWaterGoalA11y')}
            className="flex-row items-center justify-between active:opacity-60"
          >
            <Text variant="label" tone="brand">
              {t('logSheet', 'waterGoal')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brand} />
          </Pressable>

          <Text variant="caption" tone="subtle">
            {t('dashboard', 'waterGoal').replace(
              '{ml}',
              (today?.goal.targetWaterMl ?? 2000).toLocaleString(),
            )}
          </Text>
        </View>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('smartMode', 'title')}</Text>
        <SegmentedControl
          options={[
            { value: 'smart' as const, label: t('smartMode', 'modeSmart') },
            { value: 'all_calories' as const, label: t('smartMode', 'modeAllCalories') },
          ]}
          value={user.calorieLeftMode}
          onChange={(calorieLeftMode) => saveProfile({ calorieLeftMode })}
        />
        <Pressable
          onPress={() => router.push('/settings/smart-mode')}
          accessibilityRole="button"
          className="active:opacity-60"
        >
          <Text variant="caption" tone="brand">
            {t('smartMode', 'explainerLink')}
          </Text>
        </Pressable>
      </Card>

      <Card flush>
        <Pressable
          onPress={() => router.push('/settings/ring-colors')}
          accessibilityRole="button"
          className="flex-row items-center justify-between px-4 py-4 active:bg-surface-alt"
        >
          <Text variant="label">{t('settings', 'ringColorsRow')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.fgMuted} />
        </Pressable>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('profileBodyStats', 'aboutYou')}</Text>

        <Row label={t('profileBodyStats', 'sex')} value={genderLabel} />
        <Row label={t('profile', 'age')} value={`${ageFromBirthYear(user.birthYear)}`} />
        <Row label={t('profile', 'height')} value={`${user.height} cm`} />
        <Row label={t('profileBodyStats', 'weight')} value={`${user.weightCurrent} kg`} />
        <Row
          label={t('onboardingGoal', 'goalWeightLabel')}
          value={`${user.weightGoal} kg`}
        />
        <Row
          label={t('profileBodyStats', 'activity')}
          value={t('activityLevel', user.activityLevel)}
        />
        <Row label={t('profileBodyStats', 'diet')} value={t('dietType', user.dietType)} />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('profileLanguage', 'heading')}</Text>
        <SegmentedControl options={languageOptions} value={locale} onChange={setLocale} />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('profile', 'appearance')}</Text>
        <SegmentedControl options={themeOptions} value={theme} onChange={setTheme} />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('profile', 'units')}</Text>
        <SegmentedControl
          options={[
            { value: 'kg' as const, label: t('profile', 'kilograms') },
            { value: 'lb' as const, label: t('profile', 'pounds') },
          ]}
          value={weightUnit}
          onChange={setWeightUnit}
        />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('profile', 'challengeProgress')}</Text>
        <SegmentedControl
          options={[
            { value: 'on' as const, label: t('developer', 'on') },
            { value: 'off' as const, label: t('developer', 'off') },
          ]}
          value={hideChallengeProgress ? 'off' : 'on'}
          onChange={(value) => setHideChallengeProgress(value === 'off')}
        />
        <Text variant="caption" tone="subtle">
          {t('profile', 'challengeProgressCaption')}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">{t('healthSync', 'heading')}</Text>
        <SegmentedControl
          options={[
            { value: 'on' as const, label: t('developer', 'on') },
            { value: 'off' as const, label: t('developer', 'off') },
          ]}
          value={healthSyncEnabled ? 'on' : 'off'}
          onChange={(value) => void toggleHealthSync(value === 'on')}
        />
        <Text variant="caption" tone="subtle">
          {t('healthSync', 'caption')}
        </Text>
      </Card>

      {__DEV__ ? (
        <Card className="gap-3">
          <Text variant="heading">{t('developer', 'heading')}</Text>
          <SegmentedControl
            options={[
              { value: 'on' as const, label: t('developer', 'on') },
              { value: 'off' as const, label: t('developer', 'off') },
            ]}
            value={devSeedEnabled ? 'on' : 'off'}
            onChange={(value) => setDevSeedEnabled(value === 'on')}
          />
          <Text variant="caption" tone="subtle">
            {t('developer', 'seedData')}
          </Text>
        </Card>
      ) : null}

      {isSignedIn ? (
        <Card flush>
          <Pressable
            onPress={confirmSignOut}
            accessibilityRole="button"
            className="flex-row items-center justify-between px-4 py-4 active:bg-surface-alt"
          >
            <Text variant="body" tone="danger">
              {t('profile', 'signOut')}
            </Text>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </Pressable>
        </Card>
      ) : null}

      <Button
        label={t('profile', 'eraseLocalData')}
        variant="ghost"
        onPress={confirmErase}
      />
    </ScrollScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
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
