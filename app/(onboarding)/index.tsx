import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BodyStatsForm } from '@/components/profile/BodyStatsForm';
import { GoalsPreviewCard } from '@/components/profile/GoalsPreviewCard';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { bodyStatsSchema } from '@/features/profile/schemas';
import type { BodyStatsValues } from '@/features/profile/schemas';
import { useProfileStore } from '@/features/profile/store';
import { haptics } from '@/lib/haptics';
import { calculateTargets } from '@/lib/nutrition';

const DEFAULT_VALUES: BodyStatsValues = {
  gender: 'female',
  birthYear: new Date().getFullYear() - 28,
  height: 165,
  weightCurrent: 65,
  weightGoal: 65,
  activityLevel: 'moderate',
  dietType: 'balanced',
  weeklyRateKg: 0,
};

/**
 * First run.
 *
 * The only thing standing between installing the app and using it. There is no
 * sign-in step and no server call: everything collected here is written to the
 * device, and an account is offered later from Profile for anyone who wants
 * their diary on a second device.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const createProfile = useProfileStore((state) => state.createProfile);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BodyStatsValues>({
    resolver: zodResolver(bodyStatsSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const values = useWatch({ control });

  // Recomputed on every keystroke so the target moves with the inputs, rather
  // than appearing only after submission.
  const preview = useMemo(() => {
    const parsed = bodyStatsSchema.safeParse(values);

    return parsed.success ? calculateTargets(parsed.data) : null;
  }, [values]);

  const onSubmit = handleSubmit((formValues) => {
    haptics.success();
    createProfile(formValues);
    // No navigation call: the root layout's guard swaps to the tabs stack the
    // moment the profile exists.
  });

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{
        padding: 16,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 32,
        gap: 16,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="gap-2 pb-2">
        <Text className="text-5xl">🥗</Text>
        <Text variant="title">Welcome to FoodFen</Text>
        <Text variant="body" tone="muted">
          A few details to work out your daily target. Everything stays on this device —
          no account, no connection needed.
        </Text>
      </View>

      <BodyStatsForm control={control} errors={errors} />

      {preview ? <GoalsPreviewCard targets={preview} /> : null}

      <Button label="Get started" onPress={() => void onSubmit()} fullWidth size="lg" />

      <Text variant="caption" tone="subtle" className="text-center">
        You can create an account later from Profile to sync across devices.
      </Text>
    </KeyboardAwareScrollView>
  );
}
