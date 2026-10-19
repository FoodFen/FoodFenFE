import { Pressable } from 'react-native';
import type {
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Scale while held. */
  pressedScale?: number;
  /** Set false for a destructive or repeated action where a buzz would annoy. */
  haptic?: boolean;
}

/**
 * A Pressable that springs down while held and back on release. The scale
 * lives in a shared value driven straight from the press events, so a press
 * never re-renders React.
 */
export function PressableScale({
  pressedScale = 0.97,
  haptic = true,
  style,
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={(event: GestureResponderEvent) => {
        if (!reducedMotion) scale.set(withSpring(pressedScale, SPRING));
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        if (!reducedMotion) scale.set(withSpring(1, SPRING));
        onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (haptic) haptics.selection();
        onPress?.(event);
      }}
      style={[animatedStyle, style]}
      {...props}
    />
  );
}
