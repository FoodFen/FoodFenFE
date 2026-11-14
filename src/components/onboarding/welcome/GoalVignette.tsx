import { useState } from 'react';
import { View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { MacroBar } from '@/components/ui/MacroBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

import { seg, useTimeline } from './useVignette';
import type { VignetteProps } from './useVignette';

/** Slide 2: the calorie ring sweeps to 65% of an 1,850 kcal goal while the macro bars fill in. Demo numbers, not user data. */

const GOAL_KCAL = 1850;
const EATEN_FRACTION = 0.65;
const REMAINING_KCAL = Math.round(GOAL_KCAL * (1 - EATEN_FRACTION));
const MACROS = [
  { macro: 'proteinG', eaten: 75, target: 116 },
  { macro: 'carbsG', eaten: 150, target: 231 },
  { macro: 'fatG', eaten: 33, target: 51 },
] as const;
const FILL_STEPS = 40;

export function GoalVignette({ played, reducedMotion }: VignetteProps) {
  const { t } = useTranslation();
  const progress = useTimeline(played, reducedMotion, 1400);
  const [fill, setFill] = useState(reducedMotion ? 1 : 0);

  // Whole-percent steps keep the macro bars from re-rendering on every frame.
  useAnimatedReaction(
    () => Math.round(seg(progress.value, 0, 0.9) * FILL_STEPS),
    (step, previous) => {
      if (step !== previous) runOnJS(setFill)(step / FILL_STEPS);
    },
  );

  const remaining = played ? REMAINING_KCAL : 0;

  return (
    <View className="w-full flex-row items-center gap-4 rounded-card border border-border bg-surface p-4">
      <ProgressRing
        progress={played ? EATEN_FRACTION : 0}
        size={128}
        strokeWidth={12}
      >
        {reducedMotion ? (
          <Text variant="title" className="text-3xl">
            {remaining.toLocaleString()}
          </Text>
        ) : (
          <AnimatedNumber value={remaining} variant="title" className="text-3xl" />
        )}
        <Text variant="caption" tone="muted">
          {t('welcome', 'goalRemaining')}
        </Text>
      </ProgressRing>

      <View className="flex-1 gap-3">
        {MACROS.map(({ macro, eaten, target }) => (
          <MacroBar key={macro} macro={macro} value={eaten * fill} target={target} className="flex-none" />
        ))}
      </View>
    </View>
  );
}
