import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0–1. Values above 1 are clamped by the caller, not here. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Overrides the brand color — used to flag an exceeded goal. */
  color?: string;
  trackColor?: string;
  /** Rendered in the middle of the ring. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The calorie ring on the Today screen.
 *
 * Drawn from 12 o'clock clockwise by rotating the whole SVG -90°, which is
 * simpler and cheaper than recomputing an arc path on every frame.
 */
export function ProgressRing({
  progress,
  size = 180,
  strokeWidth = 14,
  color,
  trackColor,
  children,
  className,
}: ProgressRingProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  // The stroke is centred on the path, so the radius has to shrink by half of
  // it or the ring clips against the viewBox edge.
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View
      className={cn('items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? colors.surfaceAlt}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? colors.brand}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>

      <View className="absolute items-center justify-center">{children}</View>
    </View>
  );
}
