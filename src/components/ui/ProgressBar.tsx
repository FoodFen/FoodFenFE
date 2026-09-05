import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';

export interface ProgressBarProps {
  /** 0–1. Values above 1 are clamped by the caller, not here. */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  className?: string;
}

/** The onboarding wizard's step progress. Linear counterpart to `ProgressRing`. */
export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor,
  className,
}: ProgressBarProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animatedProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  return (
    <View
      className={cn('overflow-hidden rounded-pill', className)}
      style={{ height, backgroundColor: trackColor ?? colors.surfaceAlt }}
    >
      <Animated.View
        style={[{ height, backgroundColor: color ?? colors.brand }, animatedStyle]}
      />
    </View>
  );
}
