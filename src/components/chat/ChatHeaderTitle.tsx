import { View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AiAvatar } from '@/components/chat/AiAvatar';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/** Navigator header title: avatar, name, and a status line that follows the reply stream. */
export function ChatHeaderTitle({ typing }: { typing: boolean }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <View className="flex-row items-center gap-3">
      <AiAvatar size={36} pulsing={typing} />
      <View>
        <Text variant="label" className="font-semibold">
          {t('chat', 'title')}
        </Text>
        <Animated.View key={typing ? 'typing' : 'ready'} entering={reducedMotion ? undefined : FadeIn.duration(180)}>
          <Text variant="caption" tone={typing ? 'brand' : 'muted'}>
            {typing ? t('chat', 'statusTyping') : t('chat', 'statusReady')}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
