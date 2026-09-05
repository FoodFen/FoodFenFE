import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import type { BodyStatsValues } from '@/features/profile/schemas';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { ACTIVITY_LABELS, DIET_LABELS } from '@/lib/nutrition';
import type { ActivityLevel, DietType, Gender } from '@/types/models';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_OPTIONS = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const DIET_OPTIONS = Object.keys(DIET_LABELS) as DietType[];
const RATE_OPTIONS = [0, 0.25, 0.5, 0.75, 1];

export interface BodyStatsFormProps {
  control: Control<BodyStatsValues>;
  errors: FieldErrors<BodyStatsValues>;
}

/**
 * The fields that determine a calorie target.
 *
 * Shared between first-run onboarding and the goals editor so the two can
 * never drift — they collect exactly the same facts, and only the surrounding
 * copy and buttons differ.
 */
export function BodyStatsForm({ control, errors }: BodyStatsFormProps) {
  return (
    <>
      <Card className="gap-4">
        <Text variant="heading">About you</Text>

        <Controller
          control={control}
          name="gender"
          render={({ field: { onChange, value } }) => (
            <Field label="Sex">
              <ChipRow options={GENDER_OPTIONS} value={value} onChange={onChange} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="birthYear"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Year of birth"
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.birthYear?.message}
              keyboardType="number-pad"
              maxLength={4}
            />
          )}
        />

        <Controller
          control={control}
          name="height"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Height (cm)"
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.height?.message}
              keyboardType="decimal-pad"
            />
          )}
        />
      </Card>

      <Card className="gap-4">
        <Text variant="heading">Weight</Text>

        <Controller
          control={control}
          name="weightCurrent"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Current (kg)"
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.weightCurrent?.message}
              keyboardType="decimal-pad"
            />
          )}
        />

        <Controller
          control={control}
          name="weightGoal"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Goal (kg)"
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.weightGoal?.message}
              hint="The same as your current weight means maintain."
              keyboardType="decimal-pad"
            />
          )}
        />

        <Controller
          control={control}
          name="weeklyRateKg"
          render={({ field: { onChange, value } }) => (
            <Field label="Pace — kg per week">
              <ChipRow
                options={RATE_OPTIONS.map((rate) => ({
                  value: rate,
                  label: rate === 0 ? 'Maintain' : `${rate} kg`,
                }))}
                value={value}
                onChange={onChange}
              />
              {errors.weeklyRateKg?.message ? (
                <Text variant="caption" tone="danger">
                  {errors.weeklyRateKg.message}
                </Text>
              ) : null}
            </Field>
          )}
        />
      </Card>

      <Card className="gap-4">
        <Text variant="heading">Activity</Text>

        <Controller
          control={control}
          name="activityLevel"
          render={({ field: { onChange, value } }) => (
            <ActivityLevelList value={value} onChange={onChange} />
          )}
        />
      </Card>

      <Card className="gap-4">
        <Text variant="heading">Diet</Text>

        <Controller
          control={control}
          name="dietType"
          render={({ field: { onChange, value } }) => (
            <ChipRow
              options={DIET_OPTIONS.map((diet) => ({
                value: diet,
                label: DIET_LABELS[diet],
              }))}
              value={value}
              onChange={onChange}
            />
          )}
        />

        <Text variant="caption" tone="subtle">
          Changes how your calories are split across protein, carbs and fat.
        </Text>
      </Card>
    </>
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

/** The activity radio list, shared with the onboarding wizard's own step. */
export function ActivityLevelList({
  value,
  onChange,
}: {
  value: ActivityLevel | undefined;
  onChange: (value: ActivityLevel) => void;
}) {
  return (
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
  );
}

/** A row of selectable chips, shared with the onboarding wizard's own steps. */
export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
  fullWidth = false,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  /**
   * Equal-width chips filling the row, for a single full-screen question.
   * `justify-center` on a shrink-wrapped row has nothing to center within —
   * this is what actually centers a short row of chips.
   */
  fullWidth?: boolean;
}) {
  return (
    <View className={cn('flex-row gap-3', fullWidth ? 'w-full' : 'flex-wrap justify-center gap-2')}>
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label}
          isSelected={option.value === value}
          onPress={() => onChange(option.value)}
          fullWidth={fullWidth}
        />
      ))}
    </View>
  );
}

/** A single chip, with a press-in/press-out scale for tactile feedback. */
function Chip({
  label,
  isSelected,
  onPress,
  fullWidth = false,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  fullWidth?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(pressed ? 0.92 : 1, { damping: 15, stiffness: 400 });
  }, [pressed, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animatedStyle, fullWidth && { flex: 1 }]}>
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        className={cn(
          'items-center justify-center rounded-pill border',
          fullWidth ? 'min-h-14 px-3 py-2' : 'h-10 px-4',
          isSelected ? 'border-brand bg-brand' : 'border-border bg-surface',
        )}
      >
        <Text
          variant="label"
          tone={isSelected ? 'onBrand' : 'default'}
          className={cn('text-center', fullWidth && 'text-base font-semibold')}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
