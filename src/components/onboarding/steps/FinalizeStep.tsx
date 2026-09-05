import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import {
  BMI_CATEGORY_LABELS,
  bmi,
  bmiCategory,
  calculateTargets,
  macroEnergyShare,
} from '@/lib/nutrition';
import { colorsFor, macroColors } from '@/theme/colors';
import type { ActivityLevel, Gender } from '@/types/models';

const BMI_MIN = 15;
const BMI_MAX = 35;
const BMI_BAND_COLORS = { light: '#93C5FD', dark: '#93C5FD' } as const; // underweight band, distinct from the theme's other tones

export interface FinalizeStepProps {
  draft: {
    gender: Gender;
    birthYear: number;
    height: number;
    weightCurrent: number;
    weightGoal: number;
    activityLevel: ActivityLevel;
    weeklyRateKg: number;
  };
  onDone: () => void;
}

/**
 * The closing UC-05 screen: a brief "creating your plan" beat, then the
 * computed targets. Nothing here is saved — `onDone` just tells the wizard
 * this was the last step, matching every other tap-to-advance screen.
 */
export function FinalizeStep({ draft, onDone }: FinalizeStepProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <View className="w-full flex-1 items-center justify-center gap-6">
        <ProgressRing progress={1} size={140} strokeWidth={10} />
        <Text variant="heading" tone="muted">
          Creating your plan…
        </Text>
      </View>
    );
  }

  return <FinalizeResults draft={draft} onDone={onDone} />;
}

function FinalizeResults({ draft, onDone }: FinalizeStepProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const macros = macroColors(resolved);

  const targets = calculateTargets({ ...draft, dietType: 'balanced' });
  const share = macroEnergyShare({
    carbsG: targets.targetCarbsG,
    proteinG: targets.targetProteinG,
    fatG: targets.targetFatG,
  });

  const bmiValue = bmi(draft.weightCurrent, draft.height);
  const category = bmiCategory(bmiValue);
  const bmiFraction = Math.min(Math.max((bmiValue - BMI_MIN) / (BMI_MAX - BMI_MIN), 0), 1);

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          Congratulations!
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          Your personal health plan is ready.
        </Text>
      </View>

      <MacroRing
        kcal={targets.targetKcal}
        share={share}
        colors={{ carbs: macros.carbs, protein: macros.protein, fat: macros.fat }}
        trackColor={colors.surfaceAlt}
      />

      <View className="w-full flex-row justify-around">
        <MacroLegend label="Carbs" color={macros.carbs} grams={targets.targetCarbsG} />
        <MacroLegend label="Protein" color={macros.protein} grams={targets.targetProteinG} />
        <MacroLegend label="Fat" color={macros.fat} grams={targets.targetFatG} />
      </View>

      <Text variant="caption" tone="subtle">
        You can edit this anytime
      </Text>

      <View className="w-full gap-3 rounded-card bg-surface-alt p-4">
        <View className="flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            Your BMI
          </Text>
        </View>
        <View className="flex-row items-baseline gap-2">
          <Text variant="display" className="text-3xl">
            {bmiValue.toFixed(1)}
          </Text>
          <Text variant="body" tone="muted">
            Your weight is
          </Text>
          <Text variant="label" tone="brand">
            {BMI_CATEGORY_LABELS[category]}
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
            Underweight
          </Text>
          <Text variant="caption" tone="subtle">
            Healthy
          </Text>
          <Text variant="caption" tone="subtle">
            Overweight
          </Text>
          <Text variant="caption" tone="subtle">
            Obese
          </Text>
        </View>
      </View>

      <Button label="Get Started" onPress={onDone} fullWidth size="lg" />
    </View>
  );
}

interface MacroRingProps {
  kcal: number;
  share: { carbsG: number; proteinG: number; fatG: number };
  colors: { carbs: string; protein: string; fat: string };
  trackColor: string;
}

/**
 * A calorie ring split into three arcs by macro energy share, rather than
 * `ProgressRing`'s single-value fill — that component only ever shows one
 * fraction (today's calorie progress), not three that sum to a whole.
 */
function MacroRing({ kcal, share, colors, trackColor }: MacroRingProps) {
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
          kcal / day
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
