import { View } from 'react-native';
import type { ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

export interface CardProps extends ViewProps {
  className?: string;
  /** Removes internal padding, for cards that host their own edge-to-edge rows. */
  flush?: boolean;
}

/**
 * The app's surface primitive. A hairline border rather than a shadow: shadows
 * render inconsistently across platforms and disappear entirely against the
 * dark theme's near-black background.
 */
export function Card({ className, flush = false, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-card border border-border bg-surface',
        !flush && 'p-4',
        className,
      )}
      {...props}
    />
  );
}

/** A titled section header for use at the top of a `Card`. */
export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('flex-row items-center justify-between pb-3', className)}
      {...props}
    />
  );
}
