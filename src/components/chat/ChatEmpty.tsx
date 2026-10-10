import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { AiAvatar } from '@/components/chat/AiAvatar';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Hero shown in place of an empty conversation: a glowing avatar, a prompt,
 * and three suggestion chips that stagger in and send on tap.
 */

const SUGGESTION_KEYS = ['suggestion1', 'suggestion2', 'suggestion3'] as const;

export function ChatEmpty({ onSuggest }: { onSuggest: (text: string) => void }) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  return (
    <View
      className="items-center justify-center gap-6 px-6"
      style={{ minHeight: height * 0.6 }}
    >
      <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(14)}>
        <AiAvatar size={72} glow />
      </Animated.View>

      <View className="items-center gap-2">
        <Text variant="heading" className="text-center">
          {t('chat', 'emptyTitle')}
        </Text>
        <Text tone="muted" className="text-center">
          {t('chat', 'emptyDescription')}
        </Text>
      </View>

      <View className="flex-row flex-wrap justify-center gap-2">
        {SUGGESTION_KEYS.map((key, index) => {
          const label = t('chat', key);

          return (
            <Animated.View
              key={key}
              entering={
                reducedMotion
                  ? undefined
                  : FadeInDown.delay(250 + index * 90)
                      .springify()
                      .damping(16)
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
