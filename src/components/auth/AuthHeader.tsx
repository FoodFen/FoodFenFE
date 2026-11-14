import { Image } from 'expo-image';
import { View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { BRAND_MASCOT } from '@/components/mascot/brandMascot';
import { SproutWash } from '@/components/ui/SproutWash';
import { Text } from '@/components/ui/Text';

/** The mascot on a Sprout Wash disc above a title and subtitle, shared by sign-in and sign-up. */

const WASH_SIZE = 128;
const MASCOT_SIZE = 96;

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const reducedMotion = useReducedMotion();

  return (
    <View className="items-center gap-4 pb-6 pt-2">
      <Animated.View
        entering={reducedMotion ? undefined : ZoomIn.springify().damping(14)}
        style={{ width: WASH_SIZE, height: WASH_SIZE }}
        className="items-center justify-center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View className="absolute inset-0">
          <SproutWash size={WASH_SIZE} />
        </View>
        <Image
          source={BRAND_MASCOT}
          style={{ width: MASCOT_SIZE, height: MASCOT_SIZE }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      <View className="items-center gap-1">
        <Text variant="title" className="text-3xl">
          {title}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
