import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { describeIngredients } from '@/features/diary/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';
import type { FoodEntry, InputMethod } from '@/types/models';

/** How the meal was captured, shown as a small provenance marker. */
const INPUT_METHOD_ICONS: Record<
  InputMethod,
  ComponentProps<typeof Ionicons>['name']
> = {
  voice: 'mic-outline',
  image: 'camera-outline',
  type: 'keypad-outline',
  manual: 'create-outline',
};

export interface FoodEntryRowProps {
  entry: FoodEntry;
  onPress?: (entry: FoodEntry) => void;
  onLongPress?: (entry: FoodEntry) => void;
  /** Replaces the input-method glyph — e.g. a food emoji in the day sheet. */
  emoji?: string;
  /** Replaces the ingredient summary line — e.g. "Bữa trưa · 12:30". */
  secondaryText?: string;
}

/**
 * One logged meal.
 *
 * Free of its own data fetching and mutations: it renders an entry and reports
 * taps upward, so it can be used identically in the diary and in any future
 * "recently logged" list.
 */
export function FoodEntryRow({
  entry,
  onPress,
  onLongPress,
  emoji,
  secondaryText,
}: FoodEntryRowProps) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const subtitle = secondaryText ?? describeIngredients(entry);

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOutLeft.duration(180)}
      layout={LinearTransition.duration(200)}
    >
      <Pressable
        onPress={() => onPress?.(entry)}
        onLongPress={() => onLongPress?.(entry)}
        accessibilityRole="button"
        accessibilityLabel={`${entry.name}, ${entry.totalKcal} ${t('common', 'calories')}, ${subtitle}`}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-surface-alt"
      >
        {emoji ? (
          <Text className="text-sm">{emoji}</Text>
        ) : (
          <Ionicons
            name={INPUT_METHOD_ICONS[entry.inputMethod]}
            size={16}
            color={colors.fgMuted}
          />
        )}

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
    </Animated.View>
  );
}
