import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

export interface MetricSectionProps {
  title: string;
  value: string | number;
  unit?: string;
  /**
   * The corner "+" button. Logging is not wired this pass, so it is left
   * undefined by every caller and only gives haptic feedback.
   */
  onAdd?: () => void;
  children?: ReactNode;
}

/**
 * The shared shell for the dashboard's stacked sections: a title with the
 * (decorative) sort handle, a large current value, a corner add button, and
 * whatever the section wants below.
 */
export function MetricSection({ title, value, unit, onAdd, children }: MetricSectionProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t } = useTranslation();

  return (
    <Card className="gap-2">
      <Pressable
        onPress={() => {
          haptics.selection();
          onAdd?.();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('dashboard', 'addA11y')} — ${title}`}
        className="absolute right-4 top-4 h-14 w-14 items-center justify-center rounded-full border border-border active:bg-surface-alt"
      >
        <Ionicons name="add" size={26} color={colors.fgMuted} />
      </Pressable>

      <View className="flex-row items-center gap-1 pr-16">
        <Text variant="caption" tone="muted">
          {title}
        </Text>
        <Ionicons name="swap-vertical" size={13} color={colors.fgSubtle} />
      </View>

      <View className="flex-row items-baseline gap-1">
        <Text variant="display" className="text-4xl">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
        {unit ? (
          <Text variant="body" tone="muted">
            {unit}
          </Text>
        ) : null}
      </View>

      {children}
    </Card>
  );
}
