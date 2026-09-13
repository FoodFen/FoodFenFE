import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { usePendingChanges } from '@/features/diary/queries';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import type { ThemePreference } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import type { Locale } from '@/lib/i18n';
import { ageFromBirthYear, totalDailyEnergyExpenditure } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';

export default function SettingsScreen() {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t, locale, setLocale } = useTranslation();

  const user = useProfileStore((state) => state.profile);
  const eraseLocalData = useProfileStore((state) => state.eraseAll);

  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const isSignedIn = session !== null;

  const { data: pendingChanges = 0 } = usePendingChanges();

  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const weightUnit = useSettingsStore((state) => state.weightUnit);
  const setWeightUnit = useSettingsStore((state) => state.setWeightUnit);
  const devSeedEnabled = useSettingsStore((state) => state.devSeedEnabled);
  const setDevSeedEnabled = useSettingsStore((state) => state.setDevSeedEnabled);

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
  const isPremium = user.subscriptionTier === 'premium';

  const genderLabel =
    user.gender === 'male'
      ? t('onboardingGender', 'male')
      : user.gender === 'female'
        ? t('onboardingGender', 'female')
        : t('onboardingGender', 'other');

  const confirmSignOut = () => {
    Alert.alert(t('profile', 'signOut'), t('profile', 'signOutMessage'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('profile', 'signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
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
        <Row label={t('onboardingGoal', 'goalWeightLabel')} value={`${user.weightGoal} kg`} />
        <Row label={t('profileBodyStats', 'activity')} value={t('activityLevel', user.activityLevel)} />
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

      <Button label={t('profile', 'eraseLocalData')} variant="ghost" onPress={confirmErase} />
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
    <View className="flex-row gap-1 rounded-xl bg-surface-alt p-1">
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
              'h-9 flex-1 items-center justify-center rounded-lg',
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
