// The mascot: renders the server art (or the bundled hand-drawn visual) for an action and plays one hop when the action changes,
// swapping the visual at the top of the hop. Decorative; the speech bubble carries the meaning.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MASCOT_VISUALS, mascotArtId } from '@/components/mascot/visuals';
import { useAppTheme } from '@/hooks/useAppTheme';
import { mascotImageUrl, type MascotAction, type MascotImages } from '@/lib/mascot';
import { colorsFor, type ThemeColors } from '@/theme/colors';

const HOP_UP_MS = 130;

export interface MascotProps {
  mascotId: string;
  images?: MascotImages;
  bodyColor?: string | null;
  action: MascotAction;
  size: number;
}

export function Mascot({ mascotId, images, bodyColor, action, size }: MascotProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(action);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || action === shown) return;

    lift.set(
      withSequence(
        withTiming(-size * 0.14, { duration: HOP_UP_MS }),
        withSpring(0, { damping: 9, stiffness: 260, mass: 0.7 }),
      ),
    );
    const id = setTimeout(() => setShown(action), HOP_UP_MS);

    return () => clearTimeout(id);
  }, [action, shown, reducedMotion, size, lift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  const current = reducedMotion ? action : shown;
  const url = images?.[current] ?? images?.idle;
  const artId = mascotArtId(mascotId);
  const Visual = MASCOT_VISUALS[artId][current];

  return (
    <Animated.View
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {url && url !== failedUrl ? (
        <Image
          source={{ uri: mascotImageUrl(url) }}
          style={{ width: size, height: size }}
          contentFit="contain"
          cachePolicy="disk"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <Visual size={size} colors={bodyColor ? ({ ...colors, brand: bodyColor } as ThemeColors) : colors} />
      )}
    </Animated.View>
  );
}
