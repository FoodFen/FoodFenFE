import { ScrollView, View } from 'react-native';
import type { ScrollViewProps, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

/**
 * Screen container.
 *
 * Applies the themed background and bottom safe-area padding. The top inset is
 * left to the navigator, which draws the header; adding it here too would
 * double the gap.
 */

/**
 * Vertical space the floating tab bar occupies above the safe area.
 *
 * The pill (not the 56pt/`h-14` log button beside it) is the taller of the
 * two: `h-11` (44pt) tab buttons plus `py-2` padding (16pt) plus its 1pt
 * border ≈ 62pt. Add the 10pt it sits off the safe area and ~64pt to
 * breathe, so the last card scrolls comfortably clear of the bar rather than
 * ending just above it: 62 + 10 + 64 = 136. Mirrors the geometry in
 * `FloatingTabBar` — change both together.
 *
 * The bar is drawn by the tabs navigator as a sibling *over* the scene, so
 * anything a `(tabs)` screen puts at its own bottom edge is hidden underneath
 * it unless that screen reserves this much.
 */
export const TAB_BAR_CLEARANCE = 136;

export interface ScreenProps extends ViewProps {
  className?: string;
  /** Adds the bottom safe-area inset. Off for screens inside the tab bar. */
  edgeToEdgeBottom?: boolean;
  /** Reserves `TAB_BAR_CLEARANCE`. On for any screen under `(tabs)`. */
  tabBar?: boolean;
  /** Adds the top safe-area inset, for the `(tabs)` screens with no header. */
  topInset?: boolean;
}

export function Screen({
  className,
  edgeToEdgeBottom = false,
  tabBar = false,
  topInset = false,
  style,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom =
    (edgeToEdgeBottom ? insets.bottom : 0) + (tabBar ? TAB_BAR_CLEARANCE : 0);

  return (
    <View
      className={cn('flex-1 bg-bg', className)}
      style={[
        topInset ? { paddingTop: insets.top } : null,
        bottom > 0 ? { paddingBottom: bottom } : null,
        style,
      ]}
      {...props}
    />
  );
}

export interface ScrollScreenProps extends ScrollViewProps {
  className?: string;
  contentClassName?: string;
  /** Extra bottom space so content clears a floating action button. */
  bottomSpacing?: number;
  /** Reserves `TAB_BAR_CLEARANCE` instead. On for any screen under `(tabs)`. */
  tabBar?: boolean;
  /** Adds the top safe-area inset, for the `(tabs)` screens with no header. */
  topInset?: boolean;
}

export function ScrollScreen({
  className,
  contentClassName,
  bottomSpacing = 24,
  tabBar = false,
  topInset = false,
  contentContainerStyle,
  style,
  ...props
}: ScrollScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className={cn('flex-1 bg-bg', className)}
      style={[topInset ? { paddingTop: insets.top } : null, style]}
      contentContainerClassName={cn('gap-4 px-4 pt-4', contentClassName)}
      contentContainerStyle={[
        {
          paddingBottom:
            insets.bottom + (tabBar ? TAB_BAR_CLEARANCE : bottomSpacing),
        },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
}
