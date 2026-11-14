import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { BRAND_MASCOT } from '@/components/mascot/brandMascot';
import { WelcomeCarousel } from '@/components/onboarding/welcome/WelcomeCarousel';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * First screen of a fresh install: a short feature tour, then start the setup
 * wizard, or sign in to restore an existing account. Nothing here requires an
 * account.
 */

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <Screen topInset edgeToEdgeBottom className="px-6 pb-6">
      <View className="w-full max-w-md flex-1 self-center">
        <View className="flex-row items-center gap-2 pt-4">
          <Image
            source={BRAND_MASCOT}
            style={{ width: 32, height: 32 }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
          <Text variant="heading">FoodFen</Text>
        </View>

        <WelcomeCarousel />

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
