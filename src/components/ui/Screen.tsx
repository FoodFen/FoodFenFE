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

export interface ScreenProps extends ViewProps {
  className?: string;
  /** Adds the bottom safe-area inset. Off for screens inside the tab bar. */
  edgeToEdgeBottom?: boolean;
}

export function Screen({
  className,
  edgeToEdgeBottom = false,
  style,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn('flex-1 bg-bg', className)}
      style={[edgeToEdgeBottom ? { paddingBottom: insets.bottom } : null, style]}
      {...props}
    />
  );
}

export interface ScrollScreenProps extends ScrollViewProps {
  className?: string;
  contentClassName?: string;
  /** Extra bottom space so content clears a floating action button. */
  bottomSpacing?: number;
}

export function ScrollScreen({
  className,
  contentClassName,
  bottomSpacing = 24,
  contentContainerStyle,
  ...props
}: ScrollScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className={cn('flex-1 bg-bg', className)}
      contentContainerClassName={cn('gap-4 px-4 pt-4', contentClassName)}
      contentContainerStyle={[
        { paddingBottom: insets.bottom + bottomSpacing },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
}
