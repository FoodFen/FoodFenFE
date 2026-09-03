import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { onboardingSchema } from '@/features/auth/schemas';
import type { OnboardingValues } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/store';
import { useUpdateProfile } from '@/features/profile/useUpdateProfile';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { ACTIVITY_LABELS, calculateGoals } from '@/lib/nutrition';
import type { ActivityLevel, GoalKind, Sex } from '@/types/models';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const GOAL_OPTIONS: { value: GoalKind; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
];

const ACTIVITY_OPTIONS = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];

const RATE_OPTIONS = [0.25, 0.5, 0.75, 1];

/**
 * Body stats and goal, which together determine the daily calorie target.
 *
 * The target is recomputed live from the form values, so the user sees what
 * their change costs before committing to it.
 */
export default function GoalsScreen() {
  const user = useAuthStore((state) => state.session?.user);
  const updateProfile = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: user
      ? {
          sex: user.sex,
          age: user.age,
          heightCm: user.heightCm,
          weightKg: user.weightKg,
          activityLevel: user.activityLevel,
          goalKind: user.goalKind,
          weeklyRateKg: user.weeklyRateKg,
        }
      : undefined,
  });

  // Watching the whole form keeps the preview in step with every keystroke.
  const values = useWatch({ control });

  const preview = useMemo(() => {
    if (!user) return null;

    const parsed = onboardingSchema.safeParse(values);
    if (!parsed.success) return null;

    // Preview the *calculated* target, so a stale custom override does not
    // mask the effect of the change being made.
    return calculateGoals({ ...user, ...parsed.data, customGoals: undefined });
  }, [user, values]);

  if (!user) return null;

  const onSubmit = handleSubmit((formValues) => {
    setFormError(null);

    updateProfile.mutate(formValues, {
      onSuccess: () => {
        haptics.success();
        router.back();
      },
      onError: (error) => {
        haptics.error();
        setFormError(
          isApiError(error) ? error.userMessage : 'Could not save your changes.',
        );
      },
    });
  });

  const isCutting = values.goalKind === 'lose';
  const isBulking = values.goalKind === 'gain';

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <Card className="gap-4">
        <Text variant="heading">About you</Text>

        <Controller
          control={control}
          name="sex"
          render={({ field: { onChange, value } }) => (
            <Field label="Sex">
              <ChipRow options={SEX_OPTIONS} value={value} onChange={onChange} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="age"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Age"
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.age?.message}
              keyboardType="number-pad"
            />
          )}
        />

        <Controller
          control={control}
          name="heightCm"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Height (cm)"
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.heightCm?.message}
              keyboardType="decimal-pad"
            />
          )}
        />

        <Controller
          control={control}
          name="weightKg"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Weight (kg)"
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.weightKg?.message}
              keyboardType="decimal-pad"
            />
          )}
        />
      </Card>

      <Card className="gap-4">
        <Text variant="heading">Activity</Text>

        <Controller
          control={control}
          name="activityLevel"
          render={({ field: { onChange, value } }) => (
            <View className="gap-2">
              {ACTIVITY_OPTIONS.map((level) => {
                const isSelected = level === value;

                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      haptics.selection();
                      onChange(level);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    className={cn(
                      'rounded-xl border p-3',
                      isSelected ? 'border-brand bg-brand-soft' : 'border-border',
                    )}
                  >
                    <Text variant="body" tone={isSelected ? 'brand' : 'default'}>
                      {ACTIVITY_LABELS[level]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </Card>

      <Card className="gap-4">
        <Text variant="heading">Goal</Text>

        <Controller
          control={control}
          name="goalKind"
          render={({ field: { onChange, value } }) => (
            <ChipRow options={GOAL_OPTIONS} value={value} onChange={onChange} />
          )}
        />

        {isCutting || isBulking ? (
          <Controller
            control={control}
            name="weeklyRateKg"
            render={({ field: { onChange, value } }) => (
              <Field label={`Rate — kg per week to ${isCutting ? 'lose' : 'gain'}`}>
                <ChipRow
                  options={RATE_OPTIONS.map((rate) => ({
                    value: rate,
                    label: `${rate} kg`,
                  }))}
                  value={value}
                  onChange={onChange}
                />
              </Field>
            )}
          />
        ) : null}
      </Card>

      {preview ? (
        <Card className="gap-3">
          <Text variant="heading">Your new targets</Text>

          <View className="flex-row items-baseline justify-between">
            <Text variant="body" tone="muted">
              Calories
            </Text>
            <Text variant="title">{preview.calories.toLocaleString()}</Text>
          </View>

          <View className="gap-2 border-t border-border pt-3">
            <PreviewRow label="Protein" value={`${preview.protein} g`} />
            <PreviewRow label="Carbs" value={`${preview.carbs} g`} />
            <PreviewRow label="Fat" value={`${preview.fat} g`} />
          </View>

          {user.customGoals ? (
            <Text variant="caption" tone="warning">
              You have custom targets set, which will keep overriding these.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {formError ? (
        <Text variant="caption" tone="danger">
          {formError}
        </Text>
      ) : null}

      <Button
        label="Save"
        onPress={() => void onSubmit()}
        loading={updateProfile.isPending}
        fullWidth
        size="lg"
      />

      <Button
        label="Reset to calculated targets"
        variant="ghost"
        onPress={() =>
          Alert.alert(
            'Reset targets',
            'This clears any custom calorie and macro targets you have set.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: () => updateProfile.mutate({ customGoals: undefined }),
              },
            ],
          )
        }
      />
    </KeyboardAwareScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="mono">{value}</Text>
    </View>
  );
}

function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              haptics.selection();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            className={cn(
              'h-10 justify-center rounded-pill border px-4',
              isSelected ? 'border-brand bg-brand' : 'border-border bg-surface',
            )}
          >
            <Text variant="label" tone={isSelected ? 'onBrand' : 'default'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
