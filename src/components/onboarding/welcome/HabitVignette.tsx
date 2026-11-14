import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { BRAND_MASCOT } from '@/components/mascot/brandMascot';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

import type { VignetteProps } from './useVignette';

/** Slide 3: the mascot drops in and bobs to rest, then the streak and coin badges pop beside it. */

const MASCOT_SIZE = 150;
const BOB_FROM = -28;
const BOB = { damping: 6, stiffness: 110 };
const POP = { damping: 10, stiffness: 220 };

export function HabitVignette({ played, reducedMotion }: VignetteProps) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const lift = useSharedValue(0);
  const streakPop = useSharedValue(reducedMotion ? 1 : 0);
  const coinPop = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      lift.value = 0;
      streakPop.value = 1;
      coinPop.value = 1;
      return;
    }

    streakPop.value = 0;
    coinPop.value = 0;
    if (played) {
      lift.value = BOB_FROM;
      lift.value = withSpring(0, BOB);
      streakPop.value = withDelay(350, withSpring(1, POP));
      coinPop.value = withDelay(550, withSpring(1, POP));
    }

    return () => {
      cancelAnimation(lift);
      cancelAnimation(streakPop);
      cancelAnimation(coinPop);
    };
  }, [played, reducedMotion, lift, streakPop, coinPop]);

  const mascotStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const streakStyle = useAnimatedStyle(() => ({
    opacity: Math.min(streakPop.value, 1),
    transform: [{ scale: streakPop.value }],
  }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: Math.min(coinPop.value, 1),
    transform: [{ scale: coinPop.value }],
  }));

  return (
    <View className="w-full flex-1 items-center justify-center">
      <Animated.View style={mascotStyle}>
        <Image
          source={BRAND_MASCOT}
          style={{ width: MASCOT_SIZE, height: MASCOT_SIZE }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      <Animated.View
        style={streakStyle}
        className="absolute left-0 top-[22%] h-9 flex-row items-center gap-1.5 rounded-pill border border-border bg-surface px-3"
      >
        <Ionicons name="flame" size={18} color={colors.warning} />
        <Text variant="label">{t('welcome', 'habitStreak')}</Text>
      </Animated.View>

      <Animated.View
        style={coinStyle}
        className="absolute bottom-[22%] right-0 h-9 flex-row items-center gap-1.5 rounded-pill border border-border bg-surface px-3"
      >
        <Ionicons name="sparkles" size={16} color={colors.warning} />
        <Text variant="label">{t('welcome', 'habitCoins')}</Text>
      </Animated.View>
    </View>
  );
}
