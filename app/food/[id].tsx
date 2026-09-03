import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useFood } from '@/features/diary/queries';
import { macroEnergyShare } from '@/lib/nutrition';

/** Nutrition detail for a single food, per 100 g. */
export default function FoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: food, isPending, error, refetch } = useFood(id);

  if (isPending) {
    return (
      <View className="flex-1 gap-4 bg-bg p-4">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
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

  const share = macroEnergyShare(food.per100g);

  return (
    <>
      <Stack.Screen options={{ title: food.name }} />

      <ScrollScreen>
        <View className="gap-1">
          <Text variant="title">{food.name}</Text>
          {food.brand ? (
            <Text variant="body" tone="muted">
              {food.brand}
            </Text>
          ) : null}
        </View>

        <Card className="gap-3">
          <Text variant="heading">Per 100 g</Text>

          <View className="flex-row items-baseline justify-between border-b border-border pb-3">
            <Text variant="body" tone="muted">
              Calories
            </Text>
            <Text variant="title">{food.per100g.calories}</Text>
          </View>

          <NutrientRow
            label="Protein"
            value={food.per100g.protein}
            percent={share.protein}
          />
          <NutrientRow label="Carbs" value={food.per100g.carbs} percent={share.carbs} />
          <NutrientRow label="Fat" value={food.per100g.fat} percent={share.fat} />

          {food.per100g.fiber !== undefined ? (
            <NutrientRow label="Fiber" value={food.per100g.fiber} indented />
          ) : null}
          {food.per100g.sugar !== undefined ? (
            <NutrientRow label="Sugar" value={food.per100g.sugar} indented />
          ) : null}
          {food.per100g.saturatedFat !== undefined ? (
            <NutrientRow
              label="Saturated fat"
              value={food.per100g.saturatedFat}
              indented
            />
          ) : null}
          {food.per100g.sodium !== undefined ? (
            <NutrientRow label="Sodium" value={food.per100g.sodium} unit="mg" indented />
          ) : null}
        </Card>

        {food.servingUnits.length > 0 ? (
          <Card className="gap-3">
            <Text variant="heading">Servings</Text>

            {food.servingUnits.map((unit) => (
              <View key={unit.id} className="flex-row items-center justify-between">
                <Text variant="body" tone="muted">
                  {unit.label}
                </Text>
                <Text variant="mono">{unit.grams} g</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Button
          label="Log this food"
          fullWidth
          size="lg"
          onPress={() =>
            router.push({ pathname: '/log/portion', params: { foodId: food.id } })
          }
        />
      </ScrollScreen>
    </>
  );
}

function NutrientRow({
  label,
  value,
  unit = 'g',
  percent,
  indented = false,
}: {
  label: string;
  value: number;
  unit?: string;
  /** Share of total energy, 0–1. Shown only for the three macros. */
  percent?: number;
  indented?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        variant="body"
        tone={indented ? 'subtle' : 'muted'}
        className={indented ? 'pl-4' : ''}
      >
        {label}
      </Text>

      <View className="flex-row items-baseline gap-2">
        {percent !== undefined ? (
          <Text variant="caption" tone="subtle">
            {Math.round(percent * 100)}%
          </Text>
        ) : null}
        <Text variant="mono">
          {value} {unit}
        </Text>
      </View>
    </View>
  );
}
