import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

/**
 * A dim layer for behind a bottom sheet.
 *
 * The `@expo/ui` sheet renders in its own Material dialog window, so its
 * built-in scrim reads as almost nothing over a dark app background. This view
 * sits in the app window instead and dims the screen the sheet is covering.
 * It never takes touches — the sheet's own outside-tap dismissal still works.
 */
export function SheetScrim({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.45)' }]}
    />
  );
}
