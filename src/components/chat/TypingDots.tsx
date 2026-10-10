import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * The "assistant is writing" bubble shown while waiting for the first streamed
 * token: three dots in an incoming-style bubble, rising in a staggered wave.
 */

const STAGGER_MS = 150;

function Dot({ index, animate }: { index: number; animate: boolean }) {
  const wave = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;

    wave.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 300 }),
          withTiming(0, { duration: 240 }),
        ),
        -1,
        false,
      ),
    );

    return () => cancelAnimation(wave);
  }, [animate, index, wave]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * wave.value,
    transform: [{ translateY: -4 * wave.value }],
  }));

  return <Animated.View className="h-2 w-2 rounded-full bg-fg-muted" style={style} />;
}

export function TypingDots() {
  const reducedMotion = useReducedMotion();

  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-[20px] rounded-bl-[6px] border-border bg-surface px-4 py-4"
      style={{ borderWidth: StyleSheet.hairlineWidth }}
      accessibilityRole="progressbar"
    >
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} animate={!reducedMotion} />
      ))}
    </View>
  );
}
