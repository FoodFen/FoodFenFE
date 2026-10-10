import Ionicons from '@expo/vector-icons/Ionicons';
import type { Chat } from '@kesha-antonov/react-native-chat';
import { useEffect } from 'react';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/**
 * Brand send circle that springs in when the composer has text and shrinks
 * away (taking its slot with it, so the pill grows) when it is empty.
 */

type SendProps = Parameters<NonNullable<ComponentProps<typeof Chat>['renderSend']>>[0];

const BUTTON_SIZE = 40;
// The input toolbar spaces the pill and this slot with an 8pt gap that must
// collapse along with the slot when the button is hidden.
const TOOLBAR_GAP = 8;

export function ChatSendButton({ text, onSend }: SendProps) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();
  const trimmed = text?.trim() ?? '';
  const hasText = trimmed.length > 0;

  const shown = useSharedValue(hasText ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    shown.value = reducedMotion
      ? hasText ? 1 : 0
      : withSpring(hasText ? 1 : 0, { damping: 16, stiffness: 240, mass: 0.7 });
  }, [hasText, reducedMotion, shown]);

  const slotStyle = useAnimatedStyle(() => {
    const open = interpolate(shown.value, [0, 1], [0, 1], 'clamp');

    return {
      width: BUTTON_SIZE * open,
      marginLeft: -TOOLBAR_GAP * (1 - open),
      opacity: open,
    };
  });

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: Math.max(shown.value, 0) * (1 - 0.1 * pressed.value) }],
  }));

  const press = (to: number) => {
    pressed.value = reducedMotion ? to : withSpring(to, { damping: 14, stiffness: 400 });
  };

  return (
    <Animated.View
      style={[{ height: 44, alignItems: 'center', justifyContent: 'center' }, slotStyle]}
      pointerEvents={hasText ? 'auto' : 'none'}
    >
      <Animated.View style={buttonStyle}>
        <Pressable
          onPress={() => onSend?.({ text: trimmed }, true)}
          onPressIn={() => press(1)}
          onPressOut={() => press(0)}
          disabled={!hasText}
          accessibilityRole="button"
          accessibilityLabel={t('chat', 'send')}
          className="items-center justify-center rounded-full bg-brand"
          style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
        >
          <Ionicons name="arrow-up" size={22} color={colors.onBrand} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
