import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { useSettingsStore } from '@/features/settings/store';
import type { ThemePreference } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import {
  ACTIVITY_LABELS,
  calculateGoals,
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

  const user = useAuthStore((state) => state.session?.user);
  const signOut = useAuthStore((state) => state.signOut);

  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const weightUnit = useSettingsStore((state) => state.weightUnit);
  const setWeightUnit = useSettingsStore((state) => state.setWeightUnit);

  if (!user) return null;

  const goals = calculateGoals(user);
  const maintenance = Math.round(totalDailyEnergyExpenditure(user));

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You will need to sign in again to see your diary.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  };

  return (
    <ScrollScreen style={{ paddingTop: insets.top }}>
      <Text variant="title" className="pt-2">
        Profile
      </Text>

      <Card className="flex-row items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
          <Text variant="heading" tone="brand">
            {(user.displayName ?? user.email).charAt(0).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1 gap-0.5">
          <Text variant="heading" numberOfLines={1}>
            {user.displayName ?? 'Your account'}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">Daily targets</Text>

        <Row label="Calories" value={`${goals.calories.toLocaleString()} kcal`} />
        <Row label="Protein" value={`${goals.protein} g`} />
        <Row label="Carbs" value={`${goals.carbs} g`} />
        <Row label="Fat" value={`${goals.fat} g`} />

        <Pressable
          onPress={() => router.push('/settings/goals')}
          accessibilityRole="button"
          className="flex-row items-center justify-between border-t border-border pt-3 active:opacity-60"
        >
          <Text variant="label" tone="brand">
            Edit goals and body stats
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brand} />
        </Pressable>

        <View>
          <Text variant="caption" tone="subtle">
            {user.customGoals
              ? 'Custom targets — these override the calculated values.'
              : `Calculated from your profile. Maintenance is about ${maintenance.toLocaleString()} kcal a day.`}
          </Text>
        </View>
      </Card>

      <Card className="gap-3">
        <Text variant="heading">About you</Text>

        <Row label="Sex" value={user.sex === 'male' ? 'Male' : 'Female'} />
        <Row label="Age" value={`${user.age}`} />
        <Row label="Height" value={`${user.heightCm} cm`} />
        <Row label="Weight" value={`${user.weightKg} kg`} />
        <Row
          label="Activity"
          value={ACTIVITY_LABELS[user.activityLevel].split(' — ')[0] ?? ''}
        />
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

      <Button
        label="Delete account"
        variant="ghost"
        onPress={() =>
          Alert.alert(
            'Delete account',
            'This permanently removes your diary and cannot be undone. Contact support to proceed.',
          )
        }
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
