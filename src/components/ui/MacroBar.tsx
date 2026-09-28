import { View } from 'react-native';

import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { progressFraction } from '@/lib/nutrition';

import { Text } from './Text';

export type MacroKey = 'proteinG' | 'carbsG' | 'fatG';

const MACRO_LABEL_KEY: Record<MacroKey, 'protein' | 'carbs' | 'fat'> = {
  proteinG: 'protein',
  carbsG: 'carbs',
  fatG: 'fat',
};

/**
 * Tailwind cannot build a class name at runtime — the compiler only sees
 * literals — so the per-macro classes are spelled out here.
 */
const MACRO_FILL_CLASSES: Record<MacroKey, string> = {
  proteinG: 'bg-protein',
  carbsG: 'bg-carbs',
  fatG: 'bg-fat',
};

const MACRO_TEXT_CLASSES: Record<MacroKey, string> = {
  proteinG: 'text-protein',
  carbsG: 'text-carbs',
  fatG: 'text-fat',
};

export interface MacroBarProps {
  macro: MacroKey;
  /** Grams consumed. */
  value: number;
  /** Grams targeted. */
  target: number;
  className?: string;
}

/** One macro's progress toward its daily gram target. */
export function MacroBar({ macro, value, target, className }: MacroBarProps) {
  const { t } = useTranslation();
  const label = t('dashboard', MACRO_LABEL_KEY[macro]);
  const fraction = progressFraction(value, target);
  const isOver = value > target && target > 0;

  return (
    <View
      className={cn('flex-1 gap-1.5', className)}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${Math.round(value)}/${Math.round(target)} g`}
      accessibilityValue={{ min: 0, max: Math.round(target), now: Math.round(value) }}
    >
      <View className="flex-row items-baseline justify-between">
        <Text variant="caption" className={MACRO_TEXT_CLASSES[macro]}>
          {label}
        </Text>
        <Text variant="caption" tone={isOver ? 'danger' : 'muted'}>
          {Math.round(value)}/{Math.round(target)} g
        </Text>
      </View>

      <View className="h-1.5 overflow-hidden rounded-pill bg-surface-alt">
        <View
          className={cn('h-full rounded-pill', MACRO_FILL_CLASSES[macro])}
          style={{ width: `${fraction * 100}%` }}
        />
      </View>
    </View>
  );
}

export interface MacroBarGroupProps {
  consumed: Record<MacroKey, number>;
  targets: Record<MacroKey, number>;
  className?: string;
}

export function MacroBarGroup({ consumed, targets, className }: MacroBarGroupProps) {
  return (
    <View className={cn('flex-row gap-4', className)}>
      {(['proteinG', 'carbsG', 'fatG'] as const).map((macro) => (
        <MacroBar
          key={macro}
          macro={macro}
          value={consumed[macro]}
          target={targets[macro]}
        />
      ))}
    </View>
  );
}
