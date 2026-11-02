import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { AiAvatar } from '@/components/chat/AiAvatar';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Intro at the top of the conversation, scrolling away with the history: a
 * large glowing avatar, a speech-bubble prompt, and three suggestion chips
 * that stagger in and send on tap.
 */

const SUGGESTION_KEYS = ['suggestion1', 'suggestion2', 'suggestion3'] as const;

export function ChatEmpty({ onSuggest }: { onSuggest: (text: string) => void }) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  return (
    <View
      className="items-center justify-center gap-4 px-6"
      style={{ minHeight: height * 0.6 }}
    >
      <Animated.View entering={reducedMotion ? undefined : ZoomIn.duration(350)}>
        <AiAvatar size={160} glow />
      </Animated.View>

      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(150)}
        className="items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3"
      >
        <View
          className="absolute -top-1.5 left-1/2 -ml-1.5 h-3 w-3 rotate-45 bg-brand-soft"
          pointerEvents="none"
        />
        <Text variant="heading" className="text-center">
          {t('chat', 'emptyTitle')}
        </Text>
        <Text tone="muted" className="text-center">
          {t('chat', 'emptyDescription')}
        </Text>
      </Animated.View>

      <View className="flex-row flex-wrap justify-center gap-2">
        {SUGGESTION_KEYS.map((key, index) => {
          const label = t('chat', key);

          return (
            <Animated.View
              key={key}
              entering={
                reducedMotion
                  ? undefined
                  : FadeInDown.duration(300).delay(400 + index * 90)
              }
            >
              <Pressable
                onPress={() => onSuggest(label)}
                accessibilityRole="button"
                accessibilityLabel={label}
                className="rounded-full border border-border bg-surface px-4 py-3 active:bg-surface-alt"
              >
                <Text variant="label">{label}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
