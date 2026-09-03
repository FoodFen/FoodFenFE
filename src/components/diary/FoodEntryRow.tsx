import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { findServingUnit } from '@/lib/nutrition';
import type { FoodEntry } from '@/types/models';

export interface FoodEntryRowProps {
  entry: FoodEntry;
  onPress?: (entry: FoodEntry) => void;
  onLongPress?: (entry: FoodEntry) => void;
}

/**
 * One logged food.
 *
 * Kept free of its own data fetching and mutations: it renders an entry and
 * reports taps upward, so it can be used identically in the diary, in search
 * results and in a "recently logged" list.
 */
export function FoodEntryRow({ entry, onPress, onLongPress }: FoodEntryRowProps) {
  const unit = findServingUnit(entry.food, entry.servingUnitId);
  const portion = unit
    ? `${formatQuantity(entry.quantity)} × ${unit.label}`
    : `${formatQuantity(entry.quantity)} g`;

  const subtitle = entry.food.brand ? `${entry.food.brand} · ${portion}` : portion;

  return (
    <Pressable
      onPress={() => onPress?.(entry)}
      onLongPress={() => onLongPress?.(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.food.name}, ${portion}, ${entry.nutrition.calories} calories`}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt"
    >
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {entry.food.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Text variant="mono" tone="muted">
        {entry.nutrition.calories}
      </Text>
    </Pressable>
  );
}

/** `1.5 × Bowl`, not `1.50 × Bowl`; whole numbers stay whole. */
function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(2).replace(/0$/, '');
}
