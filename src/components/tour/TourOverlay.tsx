import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { clamp, overlayPath, spotlightFor } from '@/features/tour/geometry';
import { TOUR_STEPS, useTourStore } from '@/features/tour/store';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The first-run tour: a dim layer with an animated rounded spotlight over the
 * current target, and a bubble with an arrow pointing at it. Rendered once in
 * the app shell; it swallows every touch outside the bubble's buttons.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MOVE_MS = 300;
const FADE_MS = 250;
const MARGIN = 16;
const MAX_BUBBLE_WIDTH = 360;
const ARROW_SIZE = 14;
const ARROW_GAP = 14;
const ARROW_EDGE_INSET = 24;

export function TourOverlay() {
  const active = useTourStore((state) => state.active);

  return active ? <ActiveTour /> : null;
}

function ActiveTour() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const step = useTourStore((state) => state.step);
  const rect = useTourStore((state) => state.rects[TOUR_STEPS[state.step] ?? 'logButton']);
  const next = useTourStore((state) => state.next);
  const finish = useTourStore((state) => state.finish);
  const [bubbleHeight, setBubbleHeight] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => subscription.remove();
  }, [finish]);

  const spotlight = rect
    ? spotlightFor(rect)
    : { x: windowWidth / 2, y: windowHeight / 2, width: 0, height: 0, radius: 0 };

  const hx = useSharedValue(spotlight.x);
  const hy = useSharedValue(spotlight.y);
  const hw = useSharedValue(spotlight.width);
  const hh = useSharedValue(spotlight.height);
  const hr = useSharedValue(spotlight.radius);

  const { x, y, width, height, radius } = spotlight;
  useEffect(() => {
    const move = (to: number) => (reducedMotion ? to : withTiming(to, { duration: MOVE_MS }));
    hx.value = move(x);
    hy.value = move(y);
    hw.value = move(width);
    hh.value = move(height);
    hr.value = move(radius);
  }, [x, y, width, height, radius, reducedMotion, hx, hy, hw, hh, hr]);

  const animatedProps = useAnimatedProps(() => ({
    d: overlayPath(hx.value, hy.value, hw.value, hh.value, hr.value),
  }));

  const bubbleWidth = Math.min(windowWidth - MARGIN * 2, MAX_BUBBLE_WIDTH);
  const isLast = step === TOUR_STEPS.length - 1;
  const targetId = TOUR_STEPS[step];

  let bubbleLeft = (windowWidth - bubbleWidth) / 2;
  let bubbleTop = (windowHeight - bubbleHeight) / 2;
  let arrow: { x: number; pointsDown: boolean } | null = null;

  if (rect) {
    const centerX = rect.x + rect.width / 2;
    const pointsDown = rect.y + rect.height / 2 > windowHeight / 2;
    bubbleLeft = clamp(centerX - bubbleWidth / 2, MARGIN, windowWidth - MARGIN - bubbleWidth);
    bubbleTop = pointsDown
      ? y - ARROW_GAP - bubbleHeight
      : y + height + ARROW_GAP;
    arrow = {
      x: clamp(centerX - bubbleLeft, ARROW_EDGE_INSET, bubbleWidth - ARROW_EDGE_INSET),
      pointsDown,
    };
  }
  bubbleTop = clamp(
    bubbleTop,
    insets.top + MARGIN,
    Math.max(insets.top + MARGIN, windowHeight - insets.bottom - MARGIN - bubbleHeight),
  );

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(FADE_MS)}
      pointerEvents="auto"
      accessibilityViewIsModal
      style={StyleSheet.absoluteFill}
    >
      <Svg width="100%" height="100%" pointerEvents="none" style={StyleSheet.absoluteFill}>
        <AnimatedPath animatedProps={animatedProps} fill="#000000" fillOpacity={0.65} fillRule="evenodd" />
      </Svg>

      <Animated.View
        key={step}
        entering={reducedMotion ? undefined : FadeIn.duration(FADE_MS)}
        onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}
        className="absolute gap-3 rounded-card bg-surface p-4"
        style={{ left: bubbleLeft, top: bubbleTop, width: bubbleWidth }}
      >
        {arrow ? (
          <View
            pointerEvents="none"
            className="absolute bg-surface"
            style={{
              left: arrow.x - ARROW_SIZE / 2,
              [arrow.pointsDown ? 'bottom' : 'top']: -ARROW_SIZE / 2 + 1,
              width: ARROW_SIZE,
              height: ARROW_SIZE,
              transform: [{ rotate: '45deg' }],
            }}
          />
        ) : null}

        {targetId ? <Text variant="body">{t('tour', targetId)}</Text> : null}

        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted">
            {t('tour', 'counter')
              .replace('{current}', String(step + 1))
              .replace('{total}', String(TOUR_STEPS.length))}
          </Text>
          <View className="flex-row items-center gap-1">
            <Button label={t('tour', 'skip')} variant="ghost" size="sm" onPress={finish} />
            <Button
              label={t('tour', isLast ? 'done' : 'next')}
              size="sm"
              onPress={isLast ? finish : next}
            />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
