import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { BUNDLED_NUTRITION_TIPS } from '@/features/logging/bundledTips';
import { useNutritionTips } from '@/features/logging/nutritionTips';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/**
 * The AI analysis wait screen: an animated visual (a scanning sweep over the
 * photo, or a pulsing sparkle for text), cycling status lines, and a rotating
 * nutrition tip. Tips come from the cached server list, falling back to the
 * bundled one, so it never waits on the network. With reduced motion the loops
 * stop and the text only fades.
 */

const TIP_INTERVAL_MS = 5000;
const STAGE_INTERVAL_MS = 1800;
const STAGE_KEYS = ['aiStageRecognize', 'aiStagePortion', 'aiStageNutrition'] as const;
const SWEEP_FRACTION = 0.25;

export function AiAnalyzingView({
  variant,
  imageUri,
}: {
  variant: 'image' | 'text';
  imageUri?: string;
}) {
  const { t, locale } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();

  const { data } = useNutritionTips();
  const tips = data && data.length > 0 ? data : BUNDLED_NUTRITION_TIPS;
  const [tipIndex, setTipIndex] = useState(() =>
    Math.floor(Math.random() * BUNDLED_NUTRITION_TIPS.length),
  );
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTipIndex((index) => index + 1), TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stage >= STAGE_KEYS.length - 1) return;

    const timer = setTimeout(() => setStage((current) => current + 1), STAGE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  const tip = tips[tipIndex % tips.length];

  return (
    <View className="w-full gap-6">
      {variant === 'image' && imageUri ? (
        <ScanningPhoto uri={imageUri} reducedMotion={reducedMotion} />
      ) : (
        <PulsingSparkle reducedMotion={reducedMotion} />
      )}

      <View accessibilityLiveRegion="polite" className="min-h-6 items-center">
        <Animated.View key={stage} entering={FadeIn.duration(300)}>
          <Text variant="label" tone="brand" className="text-center">
            {t('logManual', STAGE_KEYS[stage] ?? STAGE_KEYS[0])}
          </Text>
        </Animated.View>
      </View>

      {tip ? (
        <Animated.View
          key={tip.id}
          entering={reducedMotion ? FadeIn : FadeInDown.duration(300)}
          className="gap-2 rounded-card border border-border bg-surface p-4"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="bulb-outline" size={18} color={colors.brand} />
            <Text variant="caption" tone="brand">
              {t('logManual', 'aiTipTitle')}
            </Text>
          </View>
          <Text variant="body">{locale === 'vi' ? tip.textVi : tip.textEn}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function ScanningPhoto({ uri, reducedMotion }: { uri: string; reducedMotion: boolean }) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [height, setHeight] = useState(0);
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;

    sweep.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      false,
    );

    return () => {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
    };
  }, [reducedMotion, sweep, pulse]);

  const bandHeight = height * SWEEP_FRACTION;
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [-bandHeight, height]) }],
  }));
  const frameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [1, 0.85]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 0.985]) }],
  }));

  return (
    <Animated.View style={frameStyle}>
      <View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        className="aspect-square w-full overflow-hidden rounded-card"
      >
        <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
        {reducedMotion ? null : (
          <Animated.View
            pointerEvents="none"
            style={[
              bandStyle,
              { height: bandHeight, backgroundColor: `${colors.brand}33` },
            ]}
            className="absolute inset-x-0 top-0 justify-end"
          >
            <View className="h-0.5 bg-brand" />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

function PulsingSparkle({ reducedMotion }: { reducedMotion: boolean }) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;

    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 800 })),
      -1,
      false,
    );
    ring.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(pulse);
      cancelAnimation(ring);
    };
  }, [reducedMotion, pulse, ring]);

  const discStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.8, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.1]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 1], [0.5, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 1.7]) }],
  }));

  return (
    <View className="items-center justify-center py-6">
      {reducedMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={ringStyle}
          className="absolute h-28 w-28 rounded-full border-2 border-brand"
        />
      )}
      <Animated.View
        style={[discStyle, { backgroundColor: `${colors.brand}26` }]}
        className="h-28 w-28 items-center justify-center rounded-full"
      >
        <Ionicons name="sparkles" size={52} color={colors.brand} />
      </Animated.View>
    </View>
  );
}
