// The mascot's speech bubble: a strip that is not rendered at all until there is something to say,
// springs open, holds a few seconds, then closes and reports back through `onDone`.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useLogSheetStore } from '@/features/logging/store';
import type { MascotBubble } from '@/features/mascot/useMascotState';
import { useTranslation } from '@/hooks/useTranslation';

const HOLD_MS = 5000;
const FADE_MS = 200;
const OPEN_SPRING = { damping: 20, stiffness: 220, mass: 0.8, overshootClamping: true };

const HUNGRY_KEYS = {
  breakfast: 'hungryBreakfast',
  lunch: 'hungryLunch',
  dinner: 'hungryDinner',
} as const;

const REACTION_KEYS = {
  food: 'reactionFood',
  water: 'reactionWater',
  activity: 'reactionActivity',
} as const;

export function MascotBubbleStrip({
  bubble,
  onDone,
}: {
  bubble: MascotBubble;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const opened = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  const text =
    bubble === null
      ? null
      : bubble.type === 'hungry'
        ? t('mascot', HUNGRY_KEYS[bubble.meal])
        : bubble.type === 'thirsty'
          ? t('mascot', 'thirsty')
          : t('mascot', REACTION_KEYS[bubble.kind]);

  const finish = useCallback(() => {
    opened.current = false;
    setShown(null);
    onDone();
  }, [onDone]);

  const close = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    progress.set(
      withTiming(0, { duration: FADE_MS }, (done) => {
        if (done) runOnJS(finish)();
      }),
    );
  }, [progress, finish]);

  if (text !== shown) setShown(text);

  useEffect(() => {
    if (text !== null) return;

    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    cancelAnimation(progress);
    progress.set(0);
    opened.current = false;
  }, [text, progress]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );

  const style = useAnimatedStyle(() => ({
    height: reducedMotion
      ? progress.get() > 0
        ? contentHeight.get()
        : 0
      : contentHeight.get() * progress.get(),
    opacity: progress.get(),
  }));

  if (shown === null) return null;

  const onLayout = (event: LayoutChangeEvent) => {
    contentHeight.set(event.nativeEvent.layout.height);

    if (opened.current) return;

    opened.current = true;
    progress.set(
      reducedMotion ? withTiming(1, { duration: FADE_MS }) : withSpring(1, OPEN_SPRING),
    );
    holdTimer.current = setTimeout(close, HOLD_MS);
  };

  const onPress = () => {
    if (bubble?.type === 'hungry') useLogSheetStore.getState().present('food');
    else if (bubble?.type === 'thirsty') useLogSheetStore.getState().present('water');

    close();
  };

  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]}>
      <View className="absolute left-0 right-0 top-0 pt-3" onLayout={onLayout}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown}
          onPress={onPress}
          className="rounded-2xl bg-brand-soft px-4 py-3"
        >
          <Text variant="label">{shown}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
