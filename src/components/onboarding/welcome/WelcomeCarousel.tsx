import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { SproutWash } from '@/components/ui/SproutWash';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';

import { GoalVignette } from './GoalVignette';
import { HabitVignette } from './HabitVignette';
import { SnapVignette } from './SnapVignette';
import { usePlayed } from './useVignette';
import type { VignetteProps } from './useVignette';

/**
 * The welcome screen's feature carousel: three paged slides, each a live
 * vignette that replays when it becomes the active page, with a scroll-driven
 * pill indicator. Auto-advances (looping) unless the user is dragging or
 * Reduce Motion is on.
 */

const SLIDES: readonly {
  title: 'tagline' | 'goalTitle' | 'habitTitle';
  body: 'snapBody' | 'goalBody' | 'habitBody';
  Vignette: (props: VignetteProps) => React.JSX.Element;
}[] = [
  { title: 'tagline', body: 'snapBody', Vignette: SnapVignette },
  { title: 'goalTitle', body: 'goalBody', Vignette: GoalVignette },
  { title: 'habitTitle', body: 'habitBody', Vignette: HabitVignette },
];

const AUTO_ADVANCE_MS = 4500;

export function WelcomeCarousel() {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const [slideWidth, setSlideWidth] = useState(0);
  const stageHeight = height < 720 ? 232 : 288;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const autoScrolling = useRef(false);

  function setAutoScrolling(value: boolean) {
    autoScrolling.current = value;
  }

  function onIndexChange(next: number) {
    setIndex(next);
    if (!autoScrolling.current) haptics.selection();
  }

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onBeginDrag: () => {
      runOnJS(setPaused)(true);
      runOnJS(setAutoScrolling)(false);
    },
    onEndDrag: () => {
      runOnJS(setPaused)(false);
    },
    onMomentumEnd: () => {
      runOnJS(setAutoScrolling)(false);
    },
  });

  useAnimatedReaction(
    () =>
      Math.min(
        Math.max(Math.round(scrollX.value / (slideWidth || 1)), 0),
        SLIDES.length - 1,
      ),
    (current, previous) => {
      if (previous !== null && current !== previous) runOnJS(onIndexChange)(current);
    },
  );

  useEffect(() => {
    if (reducedMotion || paused || slideWidth === 0) return;

    const id = setTimeout(() => {
      autoScrolling.current = true;
      const next = (index + 1) % SLIDES.length;
      scrollRef.current?.scrollTo({ x: next * slideWidth, animated: true });
    }, AUTO_ADVANCE_MS);

    return () => clearTimeout(id);
  }, [index, paused, reducedMotion, slideWidth, scrollRef]);

  return (
    <View
      className="flex-1 justify-center gap-5"
      onLayout={(event) => setSlideWidth(event.nativeEvent.layout.width)}
    >
      {slideWidth > 0 && (
        <>
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ flexGrow: 0 }}
          >
            {SLIDES.map((slide, slideIndex) => (
              <Slide
                key={slide.title}
                {...slide}
                active={slideIndex === index}
                reducedMotion={reducedMotion}
                width={slideWidth}
                stageHeight={stageHeight}
              />
            ))}
          </Animated.ScrollView>

          <View
            className="flex-row items-center justify-center gap-2"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {SLIDES.map((slide, dotIndex) => (
              <Dot
                key={slide.title}
                index={dotIndex}
                width={slideWidth}
                scrollX={scrollX}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function Slide({
  title,
  body,
  Vignette,
  active,
  reducedMotion,
  width,
  stageHeight,
}: (typeof SLIDES)[number] & {
  active: boolean;
  reducedMotion: boolean;
  width: number;
  stageHeight: number;
}) {
  const { t } = useTranslation();
  const played = usePlayed(active, reducedMotion);

  return (
    <View
      style={{ width }}
      className="gap-6"
      accessible
      accessibilityLabel={`${t('welcome', title)}. ${t('welcome', body)}`}
    >
      <View
        style={{ height: stageHeight }}
        className="items-center justify-center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View className="absolute inset-0 items-center justify-center">
          <SproutWash size={stageHeight} />
        </View>
        <Vignette played={played} reducedMotion={reducedMotion} />
      </View>

      <View className="items-center gap-2 px-2">
        <Text variant="title" className="text-center">
          {t('welcome', title)}
        </Text>
        <Text tone="muted" className="text-center">
          {t('welcome', body)}
        </Text>
      </View>
    </View>
  );
}

function Dot({
  index,
  width,
  scrollX,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const trackStyle = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, range, [8, 24, 8], Extrapolation.CLAMP),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      style={trackStyle}
      className="h-2 overflow-hidden rounded-pill bg-fg-subtle/40"
    >
      <Animated.View style={fillStyle} className="absolute inset-0 bg-brand" />
    </Animated.View>
  );
}
