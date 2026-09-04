import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BodyStatsForm } from '@/components/profile/BodyStatsForm';
import { GoalsPreviewCard } from '@/components/profile/GoalsPreviewCard';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { getGoalForDate, setGoal } from '@/data/userRepository';
import { bodyStatsSchema } from '@/features/profile/schemas';
import type { BodyStatsValues } from '@/features/profile/schemas';
import { useProfileStore } from '@/features/profile/store';
import { haptics } from '@/lib/haptics';
import { calculateTargets } from '@/lib/nutrition';

/**
 * Body stats and goal.
 *
 * Saving writes the user row and, for anyone on automatic targets, a fresh
 * `daily_goal` effective today — earlier days keep the targets they were
 * actually measured against.
 */
export default function GoalsScreen() {
  const user = useProfileStore((state) => state.profile);
  const saveProfile = useProfileStore((state) => state.saveProfile);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BodyStatsValues>({
    resolver: zodResolver(bodyStatsSchema),
    defaultValues: user
      ? {
          gender: user.gender,
          birthYear: user.birthYear,
          height: user.height,
          weightCurrent: user.weightCurrent,
          weightGoal: user.weightGoal,
          activityLevel: user.activityLevel,
          dietType: user.dietType,
          weeklyRateKg: user.weeklyRateKg,
        }
      : undefined,
  });

  const values = useWatch({ control });

  const preview = useMemo(() => {
    const parsed = bodyStatsSchema.safeParse(values);

    return parsed.success ? calculateTargets(parsed.data) : null;
  }, [values]);

  if (!user) return null;

  const isManual = user.calorieCalcMode === 'manual';

  const onSubmit = handleSubmit((formValues) => {
    // `saveProfile` recomputes today's goal for `auto` users; a `manual` user's
    // typed targets are left exactly as they are.
    saveProfile(formValues);
    haptics.success();
    router.back();
  });

  const switchToCalculated = () => {
    Alert.alert(
      'Use calculated targets',
      'Your targets will be worked out from your body stats and goal from today onward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use calculated',
          onPress: () => {
            const updated = saveProfile({ calorieCalcMode: 'auto' });

            setGoal(updated.id, calculateTargets(updated));
            haptics.success();
          },
        },
      ],
    );
  };

  const currentGoal = getGoalForDate(user.id);

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <BodyStatsForm control={control} errors={errors} />

      {preview ? (
        <GoalsPreviewCard
          targets={preview}
          title={isManual ? 'What would be calculated' : 'Your new targets'}
          footnote={
            isManual ? (
              <Text variant="caption" tone="warning">
                You are on manual targets ({currentGoal?.targetKcal.toLocaleString()}{' '}
                kcal), so these calculated figures are not being used.
              </Text>
            ) : undefined
          }
        />
      ) : null}

      <Button label="Save" onPress={() => void onSubmit()} fullWidth size="lg" />

      {isManual ? (
        <Button
          label="Switch to calculated targets"
          variant="ghost"
          onPress={switchToCalculated}
        />
      ) : null}
    </KeyboardAwareScrollView>
  );
}
