// The mascot: renders the static visual for an action and plays one hop when the action changes,
// swapping the visual at the top of the hop. Decorative; the speech bubble carries the meaning.
import { useEffect, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MASCOT_VISUALS, type MascotId } from '@/components/mascot/visuals';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { MascotAction } from '@/lib/mascot';
import { colorsFor } from '@/theme/colors';

const HOP_UP_MS = 130;

export interface MascotProps {
  mascotId: MascotId;
  action: MascotAction;
  size: number;
}

export function Mascot({ mascotId, action, size }: MascotProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(action);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || action === shown) return;

    lift.set(
      withSequence(
        withTiming(-size * 0.14, { duration: HOP_UP_MS }),
        withSpring(0, { damping: 9, stiffness: 260, mass: 0.7 }),
      ),
    );
    const id = setTimeout(() => setShown(action), HOP_UP_MS);

    return () => clearTimeout(id);
  }, [action, shown, reducedMotion, size, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  const Visual = MASCOT_VISUALS[mascotId][reducedMotion ? action : shown];

  return (
    <Animated.View
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Visual size={size} colors={colors} />
    </Animated.View>
  );
}
