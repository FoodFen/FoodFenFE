import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';
import { colorsFor } from '@/theme/colors';

// React owns the value and Reanimated only transitions between values: an animated-props snapshot
// goes stale on re-render, and per-frame JS state starved React updates.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ARC_TRANSITION = {
  transitionProperty: 'strokeDashoffset',
  transitionDuration: 600,
  transitionTimingFunction: 'ease-out',
} as const;

export interface ProgressRingProps {
  /** 0–1. Values above 1 are clamped by the caller, not here. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Overrides the brand color. */
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

  const strokeColor = color ?? colors.brand;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const target = mounted ? Math.min(Math.max(progress, 0), 1) : 0;

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
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - target)}
          animatedProps={ARC_TRANSITION}
        />
      </Svg>

      <View className="absolute items-center justify-center">{children}</View>
    </View>
  );
}
