import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BodyStatsForm } from '@/components/profile/BodyStatsForm';
import { GoalsPreviewCard } from '@/components/profile/GoalsPreviewCard';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import * as logRepository from '@/data/logRepository';
import { getGoalForDate, writeCalculatedGoal } from '@/data/userRepository';
import { makeBodyStatsSchema } from '@/features/profile/schemas';
import type { BodyStatsValues } from '@/features/profile/schemas';
import { useProfileStore } from '@/features/profile/store';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { calculateTargets } from '@/lib/nutrition';
import { queryKeys } from '@/lib/queryClient';

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
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const schema = useMemo(() => makeBodyStatsSchema(t), [t]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BodyStatsValues>({
    resolver: zodResolver(schema),
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
    const parsed = schema.safeParse(values);

    return parsed.success ? calculateTargets(parsed.data) : null;
  }, [schema, values]);

  if (!user) return null;

  const isManual = user.calorieCalcMode === 'manual';

  const onSubmit = handleSubmit(({ weightCurrent, ...rest }) => {
    // Weight goes through the same log the dashboard uses — a `weight_log`
    // entry, not a direct field write — so there is one source of truth for
    // "current weight" everywhere, including the calorie formula.
    logRepository.logWeight(user.id, weightCurrent, todayKey());

    // `saveProfile` recomputes today's goal for `auto` users, using the
    // weight just logged above; a `manual` user's typed targets are left
    // exactly as they are.
    saveProfile(rest);
    void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.weight.all });
    haptics.success();
    router.back();
  });

  const switchToCalculated = () => {
    Alert.alert(
      t('goals', 'useCalculatedTitle'),
      t('goals', 'useCalculatedMessage'),
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('goals', 'useCalculatedConfirm'),
          onPress: () => {
            const updated = saveProfile({ calorieCalcMode: 'auto' });

            writeCalculatedGoal(updated);
            void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });
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
          title={t('goals', isManual ? 'whatWouldBeCalculated' : 'yourNewTargets')}
          footnote={
            isManual ? (
              <Text variant="caption" tone="warning">
                {t('goals', 'manualWarning').replace(
                  '{kcal}',
                  currentGoal?.targetKcal.toLocaleString() ?? '',
                )}
              </Text>
            ) : undefined
          }
        />
      ) : null}

      <Button label={t('common', 'save')} onPress={() => void onSubmit()} fullWidth size="lg" />

      {isManual ? (
        <Button
          label={t('goals', 'switchToCalculated')}
          variant="ghost"
          onPress={switchToCalculated}
        />
      ) : null}
    </KeyboardAwareScrollView>
  );
}
