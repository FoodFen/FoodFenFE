import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTranslation } from '@/hooks/useTranslation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A dim layer for behind a bottom sheet.
 *
 * The `@expo/ui` sheet renders in its own Material dialog window, so its
 * built-in scrim reads as almost nothing over a dark app background. This view
 * sits in the app window instead and dims the screen the sheet is covering.
 *
 * `onPress` closes the sheet itself, rather than leaning on the native sheet's
 * own outside-tap dismissal — that round-trips through `onClose`, which isn't
 * always reliable, and a scrim stuck visible after the sheet's already gone is
 * worse than handling the tap ourselves.
 */
export function SheetScrim({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <AnimatedPressable
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('common', 'dismiss')}
      style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.45)' }]}
    />
  );
}
