import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

/**
 * One cup in the water row, filled to `fillFraction` (0–1) rather than a
 * binary filled/empty block — a custom-amount total rarely lands on an exact
 * multiple of a cup, and the fill level is how that shows.
 */
export function WaterCup({
  fillFraction,
  onPress,
  showAddGlyph,
}: {
  fillFraction: number;
  onPress: () => void;
  /** A faint "+" on the first empty cup, hinting that it's tappable. */
  showAddGlyph?: boolean;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const clamped = Math.min(Math.max(fillFraction, 0), 1);
  const reducedMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <PressableScale
      onPress={() => {
        if (!reducedMotion) {
          pop.set(
            withSequence(
              withSpring(1.15, { damping: 8, stiffness: 400 }),
              withSpring(1, { damping: 12, stiffness: 300 }),
            ),
          );
        }
        onPress();
      }}
      accessibilityRole="button"
    >
      <Animated.View
        style={popStyle}
        className="h-9 w-7 justify-end overflow-hidden rounded-b-lg rounded-t-sm bg-surface-alt"
      >
        <View className="w-full bg-fat" style={{ height: `${clamped * 100}%` }} />
        {showAddGlyph && clamped === 0 ? (
          <Ionicons
            name="add"
            size={14}
            color={colors.fgSubtle}
            style={{ position: 'absolute', alignSelf: 'center', top: 10 }}
          />
        ) : null}
      </Animated.View>
    </PressableScale>
  );
}
