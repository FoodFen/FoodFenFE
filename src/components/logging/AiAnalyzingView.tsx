import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type EasingFunction,
  FadeIn,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { BUNDLED_NUTRITION_TIPS } from '@/features/logging/bundledTips';
import { useNutritionTips } from '@/features/logging/nutritionTips';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/**
 * The AI analysis wait screen: a title, an animated visual (a viewfinder with a
 * scan line over the photo, or a rippling sparkle for text), a cycling status
 * line with bouncing dots, a fake progress bar that never completes, and a
 * rotating nutrition tip. Tips come from the cached server list, falling back
 * to the bundled one, so it never waits on the network. With reduced motion the
 * loops stop and the text only fades.
 */

const TIP_INTERVAL_MS = 5000;
const TIP_OUT_MS = 180;
const TIP_IN_MS = 220;
const TIP_SHIFT = 8;
const STAGE_INTERVAL_MS = 1800;
const STAGE_KEYS = ['aiStageRecognize', 'aiStagePortion', 'aiStageNutrition'] as const;
const SCAN_LINE_HEIGHT = 3;
const SWEEP_EASING = Easing.inOut(Easing.quad);
const CORNERS = [
  'left-2.5 top-2.5 border-l-[3px] border-t-[3px] rounded-tl-[6px]',
  'right-2.5 top-2.5 border-r-[3px] border-t-[3px] rounded-tr-[6px]',
  'bottom-2.5 left-2.5 border-b-[3px] border-l-[3px] rounded-bl-[6px]',
  'bottom-2.5 right-2.5 border-b-[3px] border-r-[3px] rounded-br-[6px]',
];

function useLoop(
  enabled: boolean,
  duration: number,
  { reverse = false, easing, delay = 0 }: { reverse?: boolean; easing?: EasingFunction; delay?: number } = {},
) {
  const value = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;

    value.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing }), -1, reverse));
    return () => cancelAnimation(value);
  }, [enabled, duration, reverse, easing, delay, value]);

  return value;
}

export function AiAnalyzingView({
  variant,
  imageUri,
}: {
  variant: 'image' | 'text';
  imageUri?: string;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState(0);
  const pulse = useLoop(!reducedMotion, 700, { reverse: true });

  useEffect(() => {
    if (stage >= STAGE_KEYS.length - 1) return;

    const timer = setTimeout(() => setStage((current) => current + 1), STAGE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.15]) }],
  }));

  return (
    <View className="w-full gap-5">
      <View className="flex-row items-center justify-center gap-2">
        <Animated.View style={sparkleStyle}>
          <Ionicons name="sparkles" size={20} color={colors.brand} />
        </Animated.View>
        <Text variant="label" tone="brand">
          {t('logManual', 'aiAnalyzingTitle')}
        </Text>
      </View>

      {variant === 'image' && imageUri ? (
        <ScanningPhoto uri={imageUri} reducedMotion={reducedMotion} />
      ) : (
        <PulsingSparkle reducedMotion={reducedMotion} />
      )}

      <View className="gap-3">
        <View
          accessibilityLiveRegion="polite"
          className="min-h-6 flex-row items-center justify-center gap-1.5"
        >
          <Animated.View key={stage} entering={FadeIn.duration(300)}>
            <Text variant="label" tone="brand" className="text-center">
              {t('logManual', STAGE_KEYS[stage] ?? STAGE_KEYS[0])}
            </Text>
          </Animated.View>
          <BouncingDots reducedMotion={reducedMotion} />
        </View>
        <FakeProgress reducedMotion={reducedMotion} />
      </View>

      <TipCard reducedMotion={reducedMotion} />
    </View>
  );
}

function Ripple({
  loop,
  offset = 0,
  scale,
  opacity,
  className,
}: {
  loop: SharedValue<number>;
  offset?: number;
  scale: [number, number];
  opacity: number;
  className: string;
}) {
  const style = useAnimatedStyle(() => {
    const phase = (loop.value + offset) % 1;
    const eased = 1 - (1 - phase) * (1 - phase);
    return {
      opacity: interpolate(eased, [0, 1], [opacity, 0]),
      transform: [{ scale: interpolate(eased, [0, 1], scale) }],
    };
  });

  return <Animated.View pointerEvents="none" style={style} className={className} />;
}

function ScanningPhoto({ uri, reducedMotion }: { uri: string; reducedMotion: boolean }) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [height, setHeight] = useState(0);
  const sweep = useLoop(!reducedMotion, 1200, { reverse: true, easing: SWEEP_EASING });
  const ring = useLoop(!reducedMotion, 2000, { easing: Easing.linear });
  const breathe = useLoop(!reducedMotion, 800, { reverse: true });

  const lineStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          reducedMotion ? 0.5 : sweep.value,
          [0, 1],
          [0, Math.max(height - SCAN_LINE_HEIGHT, 0)],
        ),
      },
    ],
  }));
  const bracketStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.04]) }],
  }));

  return (
    <View
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      className="aspect-square w-full items-center justify-center overflow-hidden rounded-card"
    >
      <Image source={{ uri }} className="absolute h-full w-full" resizeMode="cover" />
      <View pointerEvents="none" className="absolute inset-0 bg-black/15" />
      <Animated.View pointerEvents="none" style={bracketStyle} className="absolute inset-0">
        {CORNERS.map((corner) => (
          <View key={corner} className={`absolute h-5 w-5 border-white ${corner}`} />
        ))}
      </Animated.View>
      {reducedMotion ? null : (
        <Ripple
          loop={ring}
          scale={[0.6, 1.8]}
          opacity={0.7}
          className="absolute h-20 w-20 rounded-full border-2 border-brand"
        />
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          lineStyle,
          { backgroundColor: colors.brand, boxShadow: `0 0 12px ${colors.brand}` },
        ]}
        className="absolute inset-x-2.5 top-0 h-[3px] rounded-full"
      />
    </View>
  );
}

function PulsingSparkle({ reducedMotion }: { reducedMotion: boolean }) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const pulse = useLoop(!reducedMotion, 800, { reverse: true });
  const ring = useLoop(!reducedMotion, 1600, { easing: Easing.linear });

  const discStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.8, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.1]) }],
  }));

  return (
    <View className="items-center justify-center py-6">
      {reducedMotion ? null : (
        <>
          <Ripple
            loop={ring}
            scale={[1, 1.7]}
            opacity={0.5}
            className="absolute h-28 w-28 rounded-full border-2 border-brand"
          />
          <Ripple
            loop={ring}
            offset={0.5}
            scale={[1, 1.7]}
            opacity={0.5}
            className="absolute h-28 w-28 rounded-full border-2 border-brand"
          />
        </>
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

function BouncingDots({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <View className="flex-row items-center gap-1">
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
}

function Dot({ index, reducedMotion }: { index: number; reducedMotion: boolean }) {
  const bounce = useLoop(!reducedMotion, 350, { reverse: true, delay: index * 150 });

  const style = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : interpolate(bounce.value, [0, 1], [0.4, 1]),
    transform: [{ translateY: interpolate(bounce.value, [0, 1], [0, -4]) }],
  }));

  return <Animated.View style={style} className="h-[5px] w-[5px] rounded-full bg-brand" />;
}

function FakeProgress({ reducedMotion }: { reducedMotion: boolean }) {
  const progress = useSharedValue(reducedMotion ? 0.3 : 0);

  useEffect(() => {
    if (reducedMotion) return;

    progress.value = withTiming(0.9, { duration: 8000, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [reducedMotion, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View className="h-1 w-full overflow-hidden rounded-full bg-border">
      <Animated.View style={fillStyle} className="h-full rounded-full bg-brand" />
    </View>
  );
}

function TipCard({ reducedMotion }: { reducedMotion: boolean }) {
  const { t, locale } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { data } = useNutritionTips();
  const tips = data && data.length > 0 ? data : BUNDLED_NUTRITION_TIPS;
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * BUNDLED_NUTRITION_TIPS.length),
  );
  const opacity = useSharedValue(0);
  const shift = useSharedValue(reducedMotion ? 0 : TIP_SHIFT);
  const countdown = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: TIP_IN_MS });
    shift.value = withTiming(0, { duration: TIP_IN_MS });
    countdown.value = 0;
    if (!reducedMotion) {
      countdown.value = withTiming(1, { duration: TIP_INTERVAL_MS, easing: Easing.linear });
    }

    const out = setTimeout(() => {
      opacity.value = withTiming(0, { duration: TIP_OUT_MS });
      if (!reducedMotion) shift.value = withTiming(-TIP_SHIFT, { duration: TIP_OUT_MS });
    }, TIP_INTERVAL_MS - TIP_OUT_MS);
    const swap = setTimeout(() => {
      shift.value = reducedMotion ? 0 : TIP_SHIFT;
      setIndex((current) => current + 1);
    }, TIP_INTERVAL_MS);

    return () => {
      clearTimeout(out);
      clearTimeout(swap);
      cancelAnimation(opacity);
      cancelAnimation(shift);
      cancelAnimation(countdown);
    };
  }, [index, reducedMotion, opacity, shift, countdown]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: shift.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${countdown.value * 100}%` }));

  const tip = tips[index % tips.length];
  if (!tip) return null;

  return (
    <View className="overflow-hidden rounded-card border border-border bg-surface p-4">
      <Animated.View style={contentStyle} className="gap-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name="bulb" size={18} color={colors.carbs} />
          <Text variant="caption" tone="brand">
            {t('logManual', 'aiTipTitle')}
          </Text>
        </View>
        <Text variant="body">{locale === 'vi' ? tip.textVi : tip.textEn}</Text>
      </Animated.View>
      {reducedMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={[barStyle, { backgroundColor: `${colors.carbs}66` }]}
          className="absolute bottom-0 left-0 h-0.5"
        />
      )}
    </View>
  );
}
