import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

/**
 * The assistant's round brand avatar. `pulsing` adds an expanding ring while a
 * reply is being written; `glow` is the larger, softer halo used on the empty
 * state hero.
 */

export interface AiAvatarProps {
  size?: number;
  pulsing?: boolean;
  glow?: boolean;
}

export function AiAvatar({ size = 28, pulsing = false, glow = false }: AiAvatarProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();
  const ring = useSharedValue(0);
  const animateRing = pulsing && !reducedMotion;

  useEffect(() => {
    if (!animateRing) return;

    ring.value = 0;
    ring.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(ring);
      ring.value = 0;
    };
  }, [animateRing, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ring.value),
    transform: [{ scale: 1 + 0.6 * ring.value }],
  }));

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {animateRing ? (
        <Animated.View
          pointerEvents="none"
          className="absolute"
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: colors.brand,
            },
            ringStyle,
          ]}
        />
      ) : null}
      <View
        className="items-center justify-center bg-brand"
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: colors.brand,
          shadowOpacity: glow ? 0.45 : 0.3,
          shadowRadius: glow ? 24 : 8,
          shadowOffset: { width: 0, height: glow ? 8 : 2 },
          elevation: glow ? 8 : 3,
        }}
      >
        <Ionicons name="sparkles" size={Math.round(size * 0.5)} color={colors.onBrand} />
      </View>
    </View>
  );
}
