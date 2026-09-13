import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
/** How often the percentage readout ticks — the stroke itself animates smoothly on the UI thread regardless of this. */
const PERCENT_TICK_MS = 100;

export interface CalculatingRingProps {
  /** Seconds to fill from 0% to 100%. */
  duration: number;
  size?: number;
  strokeWidth?: number;
  /** Fires once, when the fill reaches 100%. */
  onCompleted: () => void;
}

/**
 * A ring that fills itself over `duration` seconds and reports when it's
 * done — unlike `ProgressRing`, which just tracks whatever `progress` value
 * its caller feeds it. Kept separate rather than folding a "drive yourself"
 * mode into that component, since the two have essentially nothing in common
 * except drawing a circle.
 */
export function CalculatingRing({
  duration,
  size = 140,
  strokeWidth = 10,
  onCompleted,
}: CalculatingRingProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [percent, setPercent] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    const durationMs = duration * 1000;
    const startedAt = Date.now();

    progress.value = withTiming(1, { duration: durationMs, easing: Easing.linear });

    // The stroke animates on the UI thread via the shared value above; this
    // is only for the percentage text, which can't read that value directly.
    const percentTimer = setInterval(() => {
      setPercent(Math.min(100, Math.round(((Date.now() - startedAt) / durationMs) * 100)));
    }, PERCENT_TICK_MS);

    const completeTimer = setTimeout(() => {
      clearInterval(percentTimer);
      setPercent(100);
      onCompleted();
    }, durationMs);

    return () => {
      clearInterval(percentTimer);
      clearTimeout(completeTimer);
    };
    // Runs once for this mount's whole animation; `duration`/`onCompleted`
    // changing mid-fill isn't a case this screen produces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceAlt}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.brand}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>

      <View className="absolute items-center justify-center">
        <Text variant="heading">{percent}%</Text>
      </View>
    </View>
  );
}
