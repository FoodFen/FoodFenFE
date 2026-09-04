import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { describeIngredients } from '@/features/diary/selectors';
import type { FoodEntry, InputMethod } from '@/types/models';

/** How the meal was captured, shown as a small provenance marker. */
const INPUT_METHOD_ICONS: Record<InputMethod, string> = {
  voice: '🎙️',
  image: '📷',
  type: '⌨️',
  manual: '✏️',
};

export interface FoodEntryRowProps {
  entry: FoodEntry;
  onPress?: (entry: FoodEntry) => void;
  onLongPress?: (entry: FoodEntry) => void;
}

/**
 * One logged meal.
 *
 * Free of its own data fetching and mutations: it renders an entry and reports
 * taps upward, so it can be used identically in the diary and in any future
 * "recently logged" list.
 */
export function FoodEntryRow({ entry, onPress, onLongPress }: FoodEntryRowProps) {
  const subtitle = describeIngredients(entry);

  return (
    <Pressable
      onPress={() => onPress?.(entry)}
      onLongPress={() => onLongPress?.(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, ${entry.totalKcal} calories, ${subtitle}`}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt"
    >
      <Text className="text-sm">{INPUT_METHOD_ICONS[entry.inputMethod]}</Text>

      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {entry.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Text variant="mono" tone="muted">
        {entry.totalKcal}
      </Text>
    </Pressable>
  );
}
