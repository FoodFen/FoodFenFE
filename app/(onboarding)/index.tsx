import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * First screen of a fresh install: start the setup wizard, or sign in to
 * restore an existing account. Nothing here requires an account.
 */

const MASCOT_IMAGE = require('../../assets/mascot.png') as number;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <Screen topInset edgeToEdgeBottom className="px-6 pb-6">
      <View className="w-full max-w-md flex-1 self-center">
        <View className="flex-1 items-center justify-center gap-3">
          <Animated.View entering={reducedMotion ? undefined : ZoomIn.duration(350)}>
            <Image
              source={MASCOT_IMAGE}
              style={{ width: 200, height: 200 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(150)}
            className="items-center gap-2"
          >
            <Text variant="title" className="text-5xl">
              FoodFen
            </Text>
            <Text variant="heading" className="text-center">
              {t('welcome', 'tagline')}
            </Text>
            <Text tone="muted" className="text-center">
              {t('welcome', 'subtitle')}
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(300)}
          className="gap-3"
        >
          <Button
            label={t('welcome', 'getStarted')}
            onPress={() => router.push('/setup')}
            size="lg"
            fullWidth
          />
          <Button
            label={t('welcome', 'haveAccount')}
            onPress={() => router.push('/sign-in')}
            variant="secondary"
            size="lg"
            fullWidth
          />
          <Text variant="caption" tone="muted" className="text-center">
            {t('welcome', 'guestNote')}
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
}
