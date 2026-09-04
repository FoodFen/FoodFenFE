import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { draftName, draftTotals, useDraftStore } from '@/features/diary/draftStore';
import { useLogMeal } from '@/features/diary/queries';
import { MEAL_LABELS } from '@/features/diary/selectors';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';
import { MEAL_TYPES } from '@/types/models';
import type { MealType } from '@/types/models';

/**
 * Compose a meal from its ingredients, then log it.
 *
 * A meal is a list of ingredients with a name, matching how the entry is
 * stored: `food_entry` holds the totals and `ingredient` holds the parts. The
 * totals here are computed from the draft as it is edited, so the number the
 * user sees before saving is the number that gets written.
 */
export default function MealComposerScreen() {
  const params = useLocalSearchParams<{ date?: string; mealType?: MealType }>();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const isPremium = useIsPremium();

  const draft = useDraftStore();
  const logMeal = useLogMeal();

  const date = params.date ?? todayKey();

  // Start a fresh draft when the flow is entered, keyed on the day and meal
  // that was tapped. Guarded so re-rendering (or returning from the ingredient
  // picker) does not wipe what has been added.
  useEffect(() => {
    if (draft.loggedOn !== date || draft.ingredients.length > 0) return;

    draft.start(date, params.mealType ?? draft.mealType);
    // Intentionally runs on mount only; the store owns the draft from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => draftTotals(draft.ingredients), [draft.ingredients]);
  const canSave = draft.ingredients.length > 0 && !logMeal.isPending;

  const save = () => {
    logMeal.mutate(
      {
        name: draftName(draft.name, draft.ingredients),
        mealType: draft.mealType,
        inputMethod: draft.inputMethod,
        loggedOn: date,
        ingredients: draft.ingredients,
      },
      {
        onSuccess: () => {
          haptics.success();
          draft.reset();
          // Dismiss the whole logging stack, not just this screen.
          router.dismissAll();
        },
        onError: (error) => {
          haptics.error();
          Alert.alert(
            'Could not save that meal',
            error instanceof Error ? error.message : 'Please try again.',
          );
        },
      },
    );
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <Card className="gap-4">
        <Input
          label="Meal name"
          value={draft.name}
          onChangeText={draft.setName}
          placeholder={draftName('', draft.ingredients)}
          hint="Optional — we will name it after its ingredients."
          autoCapitalize="sentences"
        />

        <View className="gap-2">
          <Text variant="label" tone="muted">
            Meal
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => (
              <Chip
                key={meal}
                label={MEAL_LABELS[meal]}
                selected={meal === draft.mealType}
                onPress={() => draft.setMealType(meal)}
              />
            ))}
          </View>
        </View>
      </Card>

      <Card flush className="overflow-hidden">
        <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
          <Text variant="heading">Ingredients</Text>
          {draft.ingredients.length > 0 ? (
            <Text variant="mono" tone="muted">
              {totals.kcal} kcal
            </Text>
          ) : null}
        </View>

        {draft.ingredients.length === 0 ? (
          <View className="px-4 pb-3">
            <Text variant="body" tone="subtle">
              Add what was in this meal. Pick from the built-in list, or enter your own.
            </Text>
          </View>
        ) : (
          <View className="border-t border-border">
            {draft.ingredients.map((row) => (
              <View
                key={row.key}
                className="flex-row items-center gap-3 border-b border-border px-4 py-3"
              >
                <View className="flex-1 gap-0.5">
                  <Text variant="body" numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {Math.round(row.quantityG)} g · {row.proteinG}P / {row.carbsG}C /{' '}
                    {row.fatG}F
                  </Text>
                </View>

                <Text variant="mono" tone="muted">
                  {row.kcal}
                </Text>

                <Pressable
                  onPress={() => {
                    haptics.impact();
                    draft.removeIngredient(row.key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${row.name}`}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={colors.fgSubtle} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => {
            haptics.selection();
            router.push('/log/ingredient');
          }}
          accessibilityRole="button"
          accessibilityLabel="Add an ingredient"
          className="flex-row items-center gap-2 border-t border-border px-4 py-3 active:bg-surface-alt"
        >
          <Text variant="label" tone="brand">
            + Add ingredient
          </Text>
        </Pressable>
      </Card>

      {draft.ingredients.length > 0 ? (
        <Card className="gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text variant="heading">Total</Text>
            <Text variant="title">{totals.kcal.toLocaleString()} kcal</Text>
          </View>

          <View className="gap-2 border-t border-border pt-3">
            <TotalRow label="Protein" value={`${totals.proteinG} g`} />
            <TotalRow label="Carbs" value={`${totals.carbsG} g`} />
            <TotalRow label="Fat" value={`${totals.fatG} g`} />
            {isPremium && totals.fiberG !== undefined && totals.fiberG !== null ? (
              <TotalRow label="Fiber" value={`${totals.fiberG} g`} />
            ) : null}
          </View>
        </Card>
      ) : null}

      <Button
        label="Save to diary"
        onPress={save}
        disabled={!canSave}
        loading={logMeal.isPending}
        fullWidth
        size="lg"
      />
    </KeyboardAwareScrollView>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
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
