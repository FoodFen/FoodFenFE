import Ionicons from '@expo/vector-icons/Ionicons';
import { addWeeks, format } from 'date-fns';
import { enUS, vi as viLocale } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { CalculatingRing } from '@/components/onboarding/CalculatingRing';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { units } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { bmi, bmiCategory, calculateTargets, macroEnergyShare, weeksToGoal } from '@/lib/nutrition';
import { colorsFor, macroColors } from '@/theme/colors';
import type { ActivityLevel, Gender, UnitSystem } from '@/types/models';

const BMI_MIN = 15;
const BMI_MAX = 35;
const BMI_BAND_COLORS = { light: '#93C5FD', dark: '#93C5FD' } as const; // underweight band, distinct from the theme's other tones

/**
 * The "calculating" beat's rotating messages, one per second — purely for
 * feel, since everything here is a synchronous local computation. Cycling
 * through what it "looks like" is doing makes the wait read as work rather
 * than an arbitrary delay. The ring's fill duration is derived from this
 * list's length, in seconds, rather than a separately hardcoded span — one
 * message per second, however many there are.
 */
const CALCULATING_MESSAGE_KEYS = ['creatingPlan', 'calculatingBmi', 'gettingInsights'] as const;
const CALCULATING_SECONDS = CALCULATING_MESSAGE_KEYS.length;
/** How long the "All set!" beat holds before the results screen replaces it. */
const COMPLETED_HOLD_MS = 500;

export interface FinalizeStepProps {
  draft: {
    gender: Gender;
    birthYear: number;
    unitSystem: UnitSystem;
    height: number;
    weightCurrent: number;
    weightGoal: number;
    activityLevel: ActivityLevel;
    weeklyRateKg: number;
  };
  onDone: () => void;
}

type Stage = 'calculating' | 'completed' | 'results';

/**
 * The closing UC-05 screen: a "calculating" beat with rotating status text, a
 * brief "All set!" pause, then the computed targets. Nothing here is saved —
 * `onDone` just tells the wizard this was the last step, matching every other
 * tap-to-advance screen.
 */
export function FinalizeStep({ draft, onDone }: FinalizeStepProps) {
  const [stage, setStage] = useState<Stage>('calculating');
  const [messageIndex, setMessageIndex] = useState(0);
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  useEffect(() => {
    if (stage !== 'calculating') return;

    const messageTimer = setInterval(() => {
      setMessageIndex((index) => Math.min(index + 1, CALCULATING_MESSAGE_KEYS.length - 1));
    }, 1000);

    return () => clearInterval(messageTimer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'completed') return;

    const timer = setTimeout(() => setStage('results'), COMPLETED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  if (stage === 'calculating') {
    return (
      <View className="w-full flex-1 items-center justify-center gap-6">
        <CalculatingRing
          duration={CALCULATING_SECONDS}
          size={140}
          strokeWidth={10}
          onCompleted={() => setStage('completed')}
        />
        <Text variant="heading" tone="muted">
          {t(
            'onboardingFinalize',
            CALCULATING_MESSAGE_KEYS[messageIndex] ?? CALCULATING_MESSAGE_KEYS[0],
          )}
        </Text>
      </View>
    );
  }

  if (stage === 'completed') {
    return (
      <View className="w-full flex-1 items-center justify-center gap-6">
        <Animated.View
          entering={ZoomIn.springify().damping(22)}
          className="h-28 w-28 items-center justify-center rounded-full bg-success/15"
        >
          <Ionicons name="checkmark" size={64} color={colors.success} />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(150)}>
          <Text variant="heading">{t('onboardingFinalize', 'calculationComplete')}</Text>
        </Animated.View>
      </View>
    );
  }

  return <FinalizeResults draft={draft} onDone={onDone} />;
}

function FinalizeResults({ draft, onDone }: FinalizeStepProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const macros = macroColors(resolved);
  const { t, locale } = useTranslation();

  const targets = calculateTargets({ ...draft, dietType: 'balanced' });
  const share = macroEnergyShare({
    carbsG: targets.targetCarbsG,
    proteinG: targets.targetProteinG,
    fatG: targets.targetFatG,
  });

  const bmiValue = bmi(draft.weightCurrent, draft.height);
  const category = bmiCategory(bmiValue);
  const bmiFraction = Math.min(Math.max((bmiValue - BMI_MIN) / (BMI_MAX - BMI_MIN), 0), 1);

  // `null` for `maintain` — there is no "reach it by" date for a target
  // that's already where the user is.
  const weeks = weeksToGoal(draft, draft.weeklyRateKg);
  const etaMessage =
    weeks > 0
      ? t('onboardingFinalize', 'etaMessage')
          .replace(
            '{weight}',
            Math.round(
              units.weightFromKg(draft.weightGoal, draft.unitSystem === 'imperial' ? 'lb' : 'kg'),
            ).toString(),
          )
          .replace('{unit}', draft.unitSystem === 'imperial' ? 'lb' : 'kg')
          .replace(
            '{date}',
            format(
              addWeeks(new Date(), Math.ceil(weeks)),
              locale === 'vi' ? 'd MMMM, yyyy' : 'MMMM d, yyyy',
              { locale: locale === 'vi' ? viLocale : enUS },
            ),
          )
      : null;

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          {t('onboardingFinalize', 'title')}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {t('onboardingFinalize', 'subtitle')}
        </Text>
      </View>

      {etaMessage ? (
        <View className="w-full items-center rounded-card bg-brand-soft px-5 py-4">
          <Text variant="heading" tone="brand" className="text-center text-xl">
            {etaMessage}
          </Text>
        </View>
      ) : null}

      <MacroRing
        kcal={targets.targetKcal}
        share={share}
        colors={{ carbs: macros.carbs, protein: macros.protein, fat: macros.fat }}
        trackColor={colors.surfaceAlt}
        kcalPerDayLabel={t('onboardingFinalize', 'kcalPerDay')}
      />

      <View className="w-full flex-row justify-around">
        <MacroLegend
          label={t('onboardingFinalize', 'carbs')}
          color={macros.carbs}
          grams={targets.targetCarbsG}
        />
        <MacroLegend
          label={t('onboardingFinalize', 'protein')}
          color={macros.protein}
          grams={targets.targetProteinG}
        />
        <MacroLegend
          label={t('onboardingFinalize', 'fat')}
          color={macros.fat}
          grams={targets.targetFatG}
        />
      </View>

      <Text variant="caption" tone="subtle">
        {t('onboardingFinalize', 'editAnytime')}
      </Text>

      <View className="w-full gap-3 rounded-card bg-surface-alt p-4">
        <View className="flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            {t('onboardingFinalize', 'yourBmi')}
          </Text>
        </View>
        <View className="flex-row items-baseline gap-2">
          <Text variant="display" className="text-3xl">
            {bmiValue.toFixed(1)}
          </Text>
          <Text variant="body" tone="muted">
            {t('onboardingFinalize', 'yourWeightIs')}
          </Text>
          <Text variant="label" tone="brand">
            {t('bmiCategory', category)}
          </Text>
        </View>
        <View className="relative w-full">
          <View className="h-2 w-full flex-row overflow-hidden rounded-pill">
            <View className="h-full flex-1" style={{ backgroundColor: BMI_BAND_COLORS.light }} />
            <View className="h-full flex-1" style={{ backgroundColor: colors.success }} />
            <View className="h-full flex-1" style={{ backgroundColor: colors.warning }} />
            <View className="h-full flex-1" style={{ backgroundColor: colors.danger }} />
          </View>
          <View
            className="absolute h-4 w-0.5 -top-1 bg-fg"
            style={{ left: `${bmiFraction * 100}%` }}
          />
        </View>
        <View className="flex-row justify-between">
          <Text variant="caption" tone="subtle">
            {t('bmiCategory', 'underweight')}
          </Text>
          <Text variant="caption" tone="subtle">
            {t('bmiCategory', 'healthy')}
          </Text>
          <Text variant="caption" tone="subtle">
            {t('bmiCategory', 'overweight')}
          </Text>
          <Text variant="caption" tone="subtle">
            {t('bmiCategory', 'obese')}
          </Text>
        </View>
      </View>

      <Button label={t('onboardingFinalize', 'getStarted')} onPress={onDone} fullWidth size="lg" />
    </View>
  );
}

interface MacroRingProps {
  kcal: number;
  share: { carbsG: number; proteinG: number; fatG: number };
  colors: { carbs: string; protein: string; fat: string };
  trackColor: string;
  kcalPerDayLabel: string;
}

/**
 * A calorie ring split into three arcs by macro energy share, rather than
 * `ProgressRing`'s single-value fill — that component only ever shows one
 * fraction (today's calorie progress), not three that sum to a whole.
 */
function MacroRing({ kcal, share, colors, trackColor, kcalPerDayLabel }: MacroRingProps) {
  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments: { color: string; fraction: number }[] = [
    { color: colors.carbs, fraction: share.carbsG },
    { color: colors.protein, fraction: share.proteinG },
    { color: colors.fat, fraction: share.fatG },
  ];

  let offset = 0;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {segments.map((segment) => {
          if (segment.fraction <= 0) return null;

          const length = circumference * segment.fraction;
          const dashOffset = -offset * circumference;
          offset += segment.fraction;

          return (
            <Circle
              key={segment.color}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </Svg>
      <View className="absolute items-center justify-center">
        <Text variant="display" className="text-4xl">
          {kcal}
        </Text>
        <Text variant="body" tone="muted">
          {kcalPerDayLabel}
        </Text>
      </View>
    </View>
  );
}

function MacroLegend({ label, color, grams }: { label: string; color: string; grams: number }) {
  return (
    <View className="items-center gap-1">
      <View className="h-3 w-3 rounded-pill" style={{ backgroundColor: color }} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="label">{grams}g</Text>
    </View>
  );
}
