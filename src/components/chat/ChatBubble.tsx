import { Bubble } from '@kesha-antonov/react-native-chat';
import type { Chat } from '@kesha-antonov/react-native-chat';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { TypingDots } from '@/components/chat/TypingDots';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

/**
 * Telegram-style bubble: a small tail corner on the sender's side, a spring-in
 * for messages created this session (outgoing rises from the bottom-right,
 * incoming scales from the bottom-left), and the typing dots in place of the
 * text while an assistant reply has not produced its first token. Only ids in
 * `freshIds` animate, so history and "load earlier" never do.
 */

type BubbleProps = Parameters<NonNullable<ComponentProps<typeof Chat>['renderBubble']>>[0];

export type FreshIds = Set<string | number>;

const TAIL_RADIUS = 6;

export function ChatBubble({ freshIds, ...bubbleProps }: BubbleProps & { freshIds: FreshIds }) {
  const { currentMessage, position } = bubbleProps;
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();
  const outgoing = position === 'right';
  const id = currentMessage._id;

  const [animate] = useState(() => freshIds.has(id) && !reducedMotion);
  const enter = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    freshIds.delete(id);
    if (animate) enter.value = withSpring(1, { damping: 15, stiffness: 190, mass: 0.8 });
  }, [animate, enter, freshIds, id]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.6], [0, 1], 'clamp'),
    transform: [
      { translateY: (outgoing ? 24 : 12) * (1 - enter.value) },
      { scale: (outgoing ? 0.92 : 0.85) + (outgoing ? 0.08 : 0.15) * enter.value },
    ],
  }));

  const wrapperStyle = useMemo(
    () => ({
      left: {
        borderBottomLeftRadius: TAIL_RADIUS,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        maxWidth: '85%' as const,
      },
      right: { borderBottomRightRadius: TAIL_RADIUS, maxWidth: '85%' as const },
    }),
    [colors.border],
  );

  const waiting = !outgoing && !!currentMessage.streaming && !currentMessage.text;

  return (
    <Animated.View
      style={[{ flex: 1, transformOrigin: outgoing ? 'bottom right' : 'bottom left' }, entranceStyle]}
    >
      {waiting ? (
        <TypingDots />
      ) : (
        <Bubble {...bubbleProps} wrapperStyle={wrapperStyle} />
      )}
    </Animated.View>
  );
}
