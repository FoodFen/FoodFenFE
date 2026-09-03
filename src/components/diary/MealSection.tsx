import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { MEAL_ICONS, MEAL_LABELS } from '@/features/diary/selectors';
import type { MealGroup } from '@/features/diary/selectors';
import { haptics } from '@/lib/haptics';
import type { FoodEntry } from '@/types/models';

import { FoodEntryRow } from './FoodEntryRow';

export interface MealSectionProps {
  group: MealGroup;
  onAddFood: (mealType: MealGroup['mealType']) => void;
  onPressEntry?: (entry: FoodEntry) => void;
  onLongPressEntry?: (entry: FoodEntry) => void;
}

/**
 * One meal of the day, with its entries and an add affordance.
 *
 * Empty meals still render: the add row is the primary way into the logging
 * flow, and hiding it behind a "+" in the header would cost a tap on the
 * app's most-used path.
 */
export function MealSection({
  group,
  onAddFood,
  onPressEntry,
  onLongPressEntry,
}: MealSectionProps) {
  const hasEntries = group.entries.length > 0;

  return (
    <Card flush className="overflow-hidden">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-base">{MEAL_ICONS[group.mealType]}</Text>
          <Text variant="heading">{MEAL_LABELS[group.mealType]}</Text>
        </View>

        {hasEntries ? (
          <Text variant="mono" tone="muted">
            {group.totals.calories} kcal
          </Text>
        ) : null}
      </View>

      {hasEntries ? (
        <View className="border-t border-border">
          {group.entries.map((entry) => (
            <FoodEntryRow
              key={entry.id}
              entry={entry}
              onPress={onPressEntry}
              onLongPress={onLongPressEntry}
            />
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          haptics.selection();
          onAddFood(group.mealType);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Add food to ${MEAL_LABELS[group.mealType]}`}
        className="flex-row items-center gap-2 border-t border-border px-4 py-3 active:bg-surface-alt"
      >
        <Text variant="label" tone="brand">
          + Add food
        </Text>
      </Pressable>
    </Card>
  );
}
