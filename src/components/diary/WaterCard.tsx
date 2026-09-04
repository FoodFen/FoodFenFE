import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAddWater, useRemoveLastWater } from '@/features/diary/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { DateKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { progressFraction } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';

/** One tap of the glass button. */
const GLASS_ML = 250;

export interface WaterCardProps {
  date: DateKey;
  waterMl: number;
  targetMl: number;
}

/**
 * Water intake for the day.
 *
 * Each tap appends a `water_log` row rather than setting a running total, so
 * the day is made of individual drinks that can be undone one at a time —
 * which is what the minus button does.
 */
export function WaterCard({ date, waterMl, targetMl }: WaterCardProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const addWater = useAddWater();
  const removeLastWater = useRemoveLastWater();

  const glasses = Math.round(waterMl / GLASS_ML);
  const targetGlasses = Math.max(Math.round(targetMl / GLASS_ML), 1);
  const fraction = progressFraction(waterMl, targetMl);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="heading">Water</Text>
        <Text variant="mono" tone="muted">
          {waterMl.toLocaleString()} / {targetMl.toLocaleString()} ml
        </Text>
      </View>

      <View
        className="h-2 overflow-hidden rounded-pill bg-surface-alt"
        accessibilityRole="progressbar"
        accessibilityLabel={`Water: ${waterMl} of ${targetMl} millilitres`}
        accessibilityValue={{ min: 0, max: targetMl, now: waterMl }}
      >
        <View
          className="h-full rounded-pill bg-fat"
          style={{ width: `${fraction * 100}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between pt-1">
        <Text variant="caption" tone="subtle">
          {glasses} of {targetGlasses} glasses
        </Text>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => {
              haptics.selection();
              removeLastWater.mutate({ date });
            }}
            disabled={waterMl === 0}
            accessibilityRole="button"
            accessibilityLabel="Remove the last glass of water"
            className="h-10 w-10 items-center justify-center rounded-full border border-border active:bg-surface-alt disabled:opacity-40"
          >
            <Ionicons name="remove" size={18} color={colors.fgMuted} />
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.selection();
              addWater.mutate({ amountMl: GLASS_ML, date });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Add a ${GLASS_ML} millilitre glass of water`}
            className="h-10 w-10 items-center justify-center rounded-full bg-brand active:opacity-80"
          >
            <Ionicons name="add" size={20} color={colors.onBrand} />
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
