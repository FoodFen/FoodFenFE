import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

export interface MetricSectionProps {
  title: string;
  value: string | number;
  unit?: string;
  /** The corner "+" button's action. */
  onAdd?: () => void;
  children?: ReactNode;
}

/**
 * The shared shell for the dashboard's stacked sections: a title, a large current value, a corner add button, and
 * whatever the section wants below.
 */
export function MetricSection({ title, value, unit, onAdd, children }: MetricSectionProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t } = useTranslation();

  return (
    <Card className="gap-2">
      <PressableScale
        onPress={onAdd}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`${t('dashboard', 'addA11y')} — ${title}`}
        className="absolute right-4 top-4 h-10 w-10 items-center justify-center rounded-full bg-surface-alt"
      >
        <Ionicons name="add" size={22} color={colors.fg} />
      </PressableScale>

      <View className="pr-12">
        <Text variant="caption" tone="muted">
          {title}
        </Text>
      </View>

      <View className="flex-row items-baseline gap-1">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} variant="display" className="text-4xl" />
        ) : (
          <Text variant="display" className="text-4xl">
            {value}
          </Text>
        )}
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
