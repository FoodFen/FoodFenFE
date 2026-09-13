import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import type { BodyStatsValues } from '@/features/profile/schemas';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { ACTIVITY_LABELS, DIET_LABELS } from '@/lib/nutrition';
import type { ActivityLevel, DietType, Gender } from '@/types/models';

// Only used to enumerate each enum's values — the *display* label comes from
// `useTranslation` below, not from these English constants.
const ACTIVITY_OPTIONS = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const DIET_OPTIONS = Object.keys(DIET_LABELS) as DietType[];
const RATE_OPTIONS = [0, 0.25, 0.5, 0.75, 1];

const ACTIVITY_ICONS: Record<ActivityLevel, string> = {
  sedentary: '🛋️',
  light: '👟',
  moderate: '⚽',
  active: '🚴',
  very_active: '🏋️',
};

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
  const { t } = useTranslation();

  const genderOptions: { value: Gender; label: string }[] = [
    { value: 'female', label: t('onboardingGender', 'female') },
    { value: 'male', label: t('onboardingGender', 'male') },
    { value: 'other', label: t('onboardingGender', 'preferNotToAnswer') },
  ];

  const activityOptionList = ACTIVITY_OPTIONS.map((level) => ({
    value: level,
    label: t('activityLevel', level),
    description: t('activityLevelDescription', level),
    icon: ACTIVITY_ICONS[level],
  }));

  const rateOptions = RATE_OPTIONS.map((rate) => ({
    value: rate,
    label: rate === 0 ? t('onboardingGoal', 'maintain') : `${rate} kg`,
  }));

  const dietOptions = DIET_OPTIONS.map((diet) => ({
    value: diet,
    label: t('dietType', diet),
  }));

  return (
    <>
      <Card className="gap-4">
        <Text variant="heading">{t('profileBodyStats', 'aboutYou')}</Text>

        <Controller
          control={control}
          name="gender"
          render={({ field: { onChange, value } }) => (
            <Field label={t('profileBodyStats', 'sex')}>
              <ChipRow options={genderOptions} value={value} onChange={onChange} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="birthYear"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('profileBodyStats', 'yearOfBirth')}
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
              label={t('profileBodyStats', 'heightCm')}
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
        <Text variant="heading">{t('profileBodyStats', 'weight')}</Text>

        <Controller
          control={control}
          name="weightCurrent"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('profileBodyStats', 'currentKg')}
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
              label={t('profileBodyStats', 'goalKg')}
              value={String(value ?? '')}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.weightGoal?.message}
              hint={t('profileBodyStats', 'goalHint')}
              keyboardType="decimal-pad"
            />
          )}
        />

        <Controller
          control={control}
          name="weeklyRateKg"
          render={({ field: { onChange, value } }) => (
            <Field label={t('profileBodyStats', 'paceLabel')}>
              <ChipRow options={rateOptions} value={value} onChange={onChange} />
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
        <Text variant="heading">{t('profileBodyStats', 'activity')}</Text>

        <Controller
          control={control}
          name="activityLevel"
          render={({ field: { onChange, value } }) => (
            <OptionList options={activityOptionList} value={value} onChange={onChange} />
          )}
        />
      </Card>

      <Card className="gap-4">
        <Text variant="heading">{t('profileBodyStats', 'diet')}</Text>

        <Controller
          control={control}
          name="dietType"
          render={({ field: { onChange, value } }) => (
            <ChipRow options={dietOptions} value={value} onChange={onChange} />
          )}
        />

        <Text variant="caption" tone="subtle">
          {t('profileBodyStats', 'dietHint')}
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
  const { t } = useTranslation();

  const activityOptionList = ACTIVITY_OPTIONS.map((level) => ({
    value: level,
    label: t('activityLevel', level),
    description: t('activityLevelDescription', level),
    icon: ACTIVITY_ICONS[level],
  }));

  return <OptionList options={activityOptionList} value={value} onChange={onChange} />;
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
  /** A muted caption under the label. */
  description?: string;
  /** An emoji rendered to the left of the label. */
  icon?: string;
}

/**
 * A vertical list of full-width, selectable rows — one question, one tap.
 * Shared by every single-choice onboarding step (gender, units, activity,
 * goal direction, pace) so they read as one consistent picker, not several.
 */
export function OptionList<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View className="w-full gap-3">
      {options.map((option) => (
        <OptionRow
          key={String(option.value)}
          option={option}
          isSelected={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

/** A single option row, with a press-in/press-out scale for tactile feedback. */
function OptionRow<T extends string | number>({
  option,
  isSelected,
  onPress,
}: {
  option: Option<T>;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    // A timing curve, not a spring — subtle feedback with no overshoot/bounce.
    scale.value = withTiming(pressed ? 0.98 : 1, { duration: 100 });
  }, [pressed, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
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
          'flex-row items-center gap-3 rounded-2xl border p-4',
          isSelected ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface-alt',
        )}
      >
        {option.icon ? <Text className="text-2xl">{option.icon}</Text> : null}
        <View className="flex-1 gap-0.5">
          <Text variant="body" tone={isSelected ? 'brand' : 'default'} className="font-semibold">
            {option.label}
          </Text>
          {option.description ? (
            <Text variant="caption" tone="muted">
              {option.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** A row of selectable chips — the compact form used in the dense goals editor. */
export function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap justify-center gap-2">
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label}
          isSelected={option.value === value}
          onPress={() => onChange(option.value)}
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
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    // A timing curve, not a spring — subtle feedback with no overshoot/bounce.
    scale.value = withTiming(pressed ? 0.97 : 1, { duration: 100 });
  }, [pressed, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animatedStyle}>
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
          'h-10 items-center justify-center rounded-pill border px-4',
          isSelected ? 'border-brand bg-brand' : 'border-border bg-surface',
        )}
      >
        <Text variant="label" tone={isSelected ? 'onBrand' : 'default'}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
