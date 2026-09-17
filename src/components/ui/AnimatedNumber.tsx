import { useEffect, useState } from 'react';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from './Text';
import type { TextProps } from './Text';

export interface AnimatedNumberProps extends Omit<TextProps, 'children'> {
  value: number;
  /** Formats the tweened value for display; defaults to a comma-grouped integer. */
  format?: (value: number) => string;
}

/**
 * A number that counts up (or down) to its new value instead of snapping,
 * matching `ProgressRing`/`ProgressBar`'s tween. Reads on the JS thread —
 * fine for a handful of dashboard headline numbers, not for a list of them.
 */
export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString(),
  ...textProps
}: AnimatedNumberProps) {
  const animated = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animated.value = withTiming(value, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [value, animated]);

  useAnimatedReaction(
    () => animated.value,
    (current) => {
      // `format` (often `.toLocaleString()`) is plain JS, not a worklet — it
      // has to run after `runOnJS` hands control back to the JS thread, not
      // inside this reaction, which executes on the UI thread.
      runOnJS(setDisplayValue)(current);
    },
  );

  return <Text {...textProps}>{format(displayValue)}</Text>;
}
