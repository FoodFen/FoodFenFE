import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import {
  ACTIVITY_LABELS,
  DIET_LABELS,
  ageFromBirthYear,
  totalDailyEnergyExpenditure,
} from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

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

  if (!user) return null;

  const maintenance = Math.round(totalDailyEnergyExpenditure(user));
  const isPremium = user.subscriptionTier === 'premium';

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Your diary stays on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const confirmErase = () => {
    Alert.alert(
      'Erase local data',
      'This permanently deletes your diary, your goals and your profile from this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () => {
            haptics.warning();
            eraseLocalData();
          },
        },
      ],
    );
  };

  return (
    <ScrollScreen style={{ paddingTop: insets.top }}>
      <Text variant="title" className="pt-2">
        Profile
      </Text>

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
                {isSignedIn ? (session.user.displayName ?? 'Your account') : 'Guest'}
              </Text>
              {isPremium ? (
                <View className="rounded-pill bg-brand px-2 py-0.5">
                  <Text variant="caption" tone="onBrand">
                    Premium
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {isSignedIn ? session.user.email : 'Tracking offline on this device'}
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
                Sign in to sync your data
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand} />
            </Pressable>
            <Text variant="caption" tone="subtle">
              Everything already works offline. An account keeps your diary backed up and
              available on another device.
            </Text>
          </View>
        )}

        {pendingChanges > 0 ? (
          <View className="flex-row items-center gap-2 border-t border-border pt-3">
            <Ionicons name="cloud-offline-outline" size={16} color={colors.fgMuted} />
            <Text variant="caption" tone="muted">
              {pendingChanges} {pendingChanges === 1 ? 'change' : 'changes'} saved on this
              device only
            </Text>
          </View>
        ) : null}
      </Card>

      <Card className="gap-3">
        <Text variant="heading">Daily targets</Text>

        <Pressable
          onPress={() => router.push('/settings/goals')}
          accessibilityRole="button"
          className="flex-row items-center justify-between active:opacity-60"
        >
          <Text variant="label" tone="brand">
            Edit goals and body stats
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brand} />
        </Pressable>

        <Text variant="caption" tone="subtle">
          {user.calorieCalcMode === 'manual'
            ? 'Set by hand — these override the calculated values.'
            : `Calculated from your profile. Maintenance is about ${maintenance.toLocaleString()} kcal a day.`}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">About you</Text>

        <Row
          label="Sex"
          value={
            user.gender === 'male'
              ? 'Male'
              : user.gender === 'female'
                ? 'Female'
                : 'Other'
          }
        />
        <Row label="Age" value={`${ageFromBirthYear(user.birthYear)}`} />
        <Row label="Height" value={`${user.height} cm`} />
        <Row label="Weight" value={`${user.weightCurrent} kg`} />
        <Row label="Goal weight" value={`${user.weightGoal} kg`} />
        <Row
          label="Activity"
          value={ACTIVITY_LABELS[user.activityLevel].split(' — ')[0] ?? ''}
        />
        <Row label="Diet" value={DIET_LABELS[user.dietType]} />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">Appearance</Text>
        <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      </Card>

      <Card className="gap-3">
        <Text variant="heading">Units</Text>
        <SegmentedControl
          options={[
            { value: 'kg' as const, label: 'Kilograms' },
            { value: 'lb' as const, label: 'Pounds' },
          ]}
          value={weightUnit}
          onChange={setWeightUnit}
        />
      </Card>

      {isSignedIn ? (
        <Card flush>
          <Pressable
            onPress={confirmSignOut}
            accessibilityRole="button"
            className="flex-row items-center justify-between px-4 py-4 active:bg-surface-alt"
          >
            <Text variant="body" tone="danger">
              Sign out
            </Text>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </Pressable>
        </Card>
      ) : null}

      <Button label="Erase local data" variant="ghost" onPress={confirmErase} />
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
