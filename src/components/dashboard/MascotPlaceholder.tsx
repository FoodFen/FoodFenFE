import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';

/**
 * Stand-in for the illustrated mascot.
 *
 * A dashed box rather than the real artwork — the illustration is not in scope
 * yet. Swap this component's body once the asset exists; nothing else needs to
 * change.
 */
export function MascotPlaceholder({ className }: { className?: string }) {
  return (
    <View
      className={cn(
        'aspect-square items-center justify-center rounded-2xl border border-dashed border-border bg-surface-alt',
        className,
      )}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="caption" tone="subtle">
        Mascot
      </Text>
    </View>
  );
}
