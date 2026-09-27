import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
}

/**
 * Loading placeholder.
 *
 * A pulsing opacity rather than a sweeping gradient: it runs entirely on the
 * UI thread with one shared value, and it reads correctly in both themes
 * without a second set of gradient stops.
 */
export function Skeleton({ className }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={cn('rounded-card bg-surface-alt', className)}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** The Today screen's loading shape, so the layout does not jump on load. */
export function DiaryDaySkeleton() {
  return (
    <View className="gap-4">
      <Skeleton className="h-64 rounded-card" />
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-28 rounded-card" />
      ))}
    </View>
  );
}
