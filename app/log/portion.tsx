import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useFood, useLogFood } from '@/features/diary/queries';
import { MEAL_LABELS } from '@/features/diary/selectors';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { nutritionForPortion } from '@/lib/nutrition';
import { MEAL_TYPES } from '@/types/models';
import type { MealType } from '@/types/models';

/**
 * Pick a portion and log it.
 *
 * Nutrition is recomputed locally as the user types, so the numbers move with
 * the quantity field instead of waiting for the server to confirm the entry.
 */
export default function PortionScreen() {
  const params = useLocalSearchParams<{
    foodId: string;
    date?: string;
    mealType?: MealType;
  }>();

  const date = params.date ?? todayKey();

  const { data: food, isPending, error, refetch } = useFood(params.foodId);
  const logFood = useLogFood();

  const [quantityText, setQuantityText] = useState('1');
  const [mealType, setMealType] = useState<MealType>(params.mealType ?? 'snack');
  const [servingUnitId, setServingUnitId] = useState<string | null>(null);

  const selectedUnitId = servingUnitId ?? food?.servingUnits[0]?.id ?? '';

  // An empty or half-typed field ("1.") must not blank out the preview, so an
  // unparseable value falls back to zero rather than NaN.
  const quantity = useMemo(() => {
    const parsed = Number(quantityText.replace(',', '.'));

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [quantityText]);

  const preview = useMemo(
    () => (food ? nutritionForPortion(food, quantity, selectedUnitId) : null),
    [food, quantity, selectedUnitId],
  );

  if (isPending) {
    return (
      <View className="flex-1 gap-4 bg-bg p-4">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </View>
    );
  }

  if (error || !food) {
    return (
      <ErrorState
        description={
          isApiError(error) ? error.userMessage : 'We could not load that food.'
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const canSubmit = quantity > 0 && !logFood.isPending;

  const submit = () => {
    logFood.mutate(
      { date, mealType, food, quantity, servingUnitId: selectedUnitId },
      {
        onSuccess: () => {
          haptics.success();
          // Dismiss the whole logging stack, not just this screen.
          router.dismissAll();
        },
        onError: (mutationError) => {
          haptics.error();
          Alert.alert(
            'Could not log that',
            isApiError(mutationError) ? mutationError.userMessage : 'Please try again.',
          );
        },
      },
    );
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="gap-1">
        <Text variant="title">{food.name}</Text>
        {food.brand ? (
          <Text variant="body" tone="muted">
            {food.brand}
          </Text>
        ) : null}
      </View>

      <Card className="gap-4">
        <Input
          label="Amount"
          value={quantityText}
          onChangeText={setQuantityText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          error={
            quantity === 0 && quantityText !== ''
              ? 'Enter an amount above zero.'
              : undefined
          }
        />

        <View className="gap-2">
          <Text variant="label" tone="muted">
            Serving
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {food.servingUnits.map((unit) => {
              const isSelected = unit.id === selectedUnitId;

              return (
                <Chip
                  key={unit.id}
                  label={unit.label}
                  selected={isSelected}
                  onPress={() => setServingUnitId(unit.id)}
                />
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <Text variant="label" tone="muted">
            Meal
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => (
              <Chip
                key={meal}
                label={MEAL_LABELS[meal]}
                selected={meal === mealType}
                onPress={() => setMealType(meal)}
              />
            ))}
          </View>
        </View>
      </Card>

      {preview ? (
        <Card className="gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text variant="heading">Calories</Text>
            <Text variant="title">{preview.calories.toLocaleString()}</Text>
          </View>

          <View className="gap-2 border-t border-border pt-3">
            <PreviewRow label="Protein" value={`${preview.protein} g`} />
            <PreviewRow label="Carbs" value={`${preview.carbs} g`} />
            <PreviewRow label="Fat" value={`${preview.fat} g`} />
            {preview.fiber !== undefined ? (
              <PreviewRow label="Fiber" value={`${preview.fiber} g`} />
            ) : null}
          </View>
        </Card>
      ) : null}

      <Button
        label="Add to diary"
        onPress={submit}
        disabled={!canSubmit}
        loading={logFood.isPending}
        fullWidth
        size="lg"
      />
    </KeyboardAwareScrollView>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="mono">{value}</Text>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={cn(
        'h-10 justify-center rounded-pill border px-4',
        selected ? 'border-brand bg-brand' : 'border-border bg-surface',
      )}
    >
      <Text variant="label" tone={selected ? 'onBrand' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}
