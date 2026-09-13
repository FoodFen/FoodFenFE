import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { Text } from '@/components/ui/Text';
import { getCatalogFood } from '@/data/foodCatalog';
import {
  useCatalogSearch,
  useQuickLogFood,
  useRecentFoods,
} from '@/features/diary/queries';
import { usePostLogInterstitial } from '@/features/gamification/queries';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { gramsForServing, nutritionForServing } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { CatalogFood } from '@/types/models';

/**
 * Search the bundled catalog, choose a portion, log it as a one-item entry.
 *
 * The empty state is the user's recent picks — tapping one jumps to the
 * portion step with its last portion prefilled. Everything after picking a
 * food mirrors the portion step in `app/log/ingredient.tsx`, but it writes
 * straight to the diary rather than a meal draft.
 */
export default function SearchFoodScreen() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{
    food: CatalogFood;
    servingId: string;
    quantity: number;
  } | null>(null);

  const debounced = useDebounce(query, 250);
  const recents = useRecentFoods();
  const recentIds = useMemo(
    () => (recents.data ?? []).map((row) => row.catalogFoodId),
    [recents.data],
  );
  const search = useCatalogSearch(debounced, recentIds);

  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  if (selected) {
    return (
      <PortionStep
        food={selected.food}
        initialServingId={selected.servingId}
        initialQuantity={selected.quantity}
        onBack={() => setSelected(null)}
      />
    );
  }

  const open = (food: CatalogFood, servingId?: string, quantity = 1) => {
    haptics.selection();
    setSelected({
      food,
      servingId:
        servingId ??
        food.servings.find((s) => s.default)?.id ??
        food.servings[0]?.id ??
        '',
      quantity,
    });
  };

  const results = search.data ?? [];
  const showResults = debounced.trim().length >= 2;
  const recentRows = recents.data ?? [];

  return (
    <View className="flex-1 bg-bg">
      <View className="px-4 pb-2 pt-3">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('logSearch', 'searchPlaceholder')}
          autoFocus
          returnKeyType="search"
          leading={<Ionicons name="search" size={18} color={colors.fgSubtle} />}
          trailing={
            query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('logSearch', 'clearSearchA11y')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.fgSubtle} />
              </Pressable>
            ) : null
          }
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1">
        {!showResults && recentRows.length > 0 ? (
          <View className="pt-1">
            <Text variant="label" tone="muted" className="px-4 py-2">
              {t('logSearch', 'recentHeading')}
            </Text>
            {recentRows.map((row) => {
              const food = getCatalogFood(row.catalogFoodId);
              if (!food) return null;

              const serving =
                [...food.servings].sort(
                  (a, b) =>
                    Math.abs(a.grams - row.quantityG) - Math.abs(b.grams - row.quantityG),
                )[0] ?? food.servings[0];
              const quantity = serving ? Math.max(row.quantityG / serving.grams, 0.5) : 1;

              return (
                <FoodRow
                  key={row.catalogFoodId}
                  name={food.name}
                  detail={`${Math.round(row.quantityG)} g`}
                  a11y={t('logSearch', 'recentA11y').replace('{name}', food.name)}
                  onPress={() => open(food, serving?.id, Math.round(quantity * 2) / 2)}
                />
              );
            })}
          </View>
        ) : null}

        {showResults
          ? results.map((food) => (
              <FoodRow
                key={food.id}
                name={food.name}
                detail={perServingLabel(food, t('logSearch', 'perServing'))}
                a11y={t('logSearch', 'foodA11y')
                  .replace('{name}', food.name)
                  .replace('{kcal}', String(food.per100g.kcal))}
                onPress={() => open(food)}
              />
            ))
          : null}

        {showResults && results.length === 0 && !search.isFetching ? (
          <EmptyState
            icon="🔍"
            title={t('logSearch', 'noMatches')}
            description={t('logSearch', 'noMatchesDescription').replace(
              '{query}',
              debounced.trim(),
            )}
          />
        ) : null}

        {!showResults && recentRows.length === 0 ? (
          <View className="px-4 pt-3">
            <Text variant="caption" tone="subtle">
              {t('logSearch', 'searchHint')}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** "{kcal} kcal / {serving}" for a food's default (or first) serving. */
function perServingLabel(food: CatalogFood, template: string): string {
  const serving = food.servings.find((s) => s.default) ?? food.servings[0];
  const grams = serving?.grams ?? 100;
  const label = serving?.label ?? '100 g';
  const kcal = Math.round((food.per100g.kcal * grams) / 100);

  return template.replace('{kcal}', String(kcal)).replace('{serving}', label);
}

function FoodRow({
  name,
  detail,
  a11y,
  onPress,
}: {
  name: string;
  detail: string;
  a11y: string;
  onPress: () => void;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      className="flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-surface-alt"
    >
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.fgSubtle} />
    </Pressable>
  );
}

function PortionStep({
  food,
  initialServingId,
  initialQuantity,
  onBack,
}: {
  food: CatalogFood;
  initialServingId: string;
  initialQuantity: number;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const isPremium = useIsPremium();
  const quickLog = useQuickLogFood();
  const finishLogging = usePostLogInterstitial();

  const [servingId, setServingId] = useState(initialServingId);
  const [quantity, setQuantity] = useState(initialQuantity);

  const serving = food.servings.find((s) => s.id === servingId) ?? food.servings[0];
  const isGramServing = serving?.grams === 100 && /100\s*g/i.test(serving.label);
  const grams = serving ? gramsForServing(quantity, serving) : quantity;
  const nutrition = nutritionForServing(food, quantity, servingId);

  const save = () => {
    quickLog.mutate(
      { catalogFoodId: food.id, servingId, quantity },
      {
        onSuccess: () => {
          haptics.success();
          finishLogging();
        },
        onError: (error) => {
          haptics.error();
          Alert.alert(
            t('logSearch', 'addErrorTitle'),
            error instanceof Error ? error.message : t('logMeal', 'saveErrorFallback'),
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
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('logIngredient', 'backToSearch')}
              style={{ paddingRight: 16 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.fg} />
            </Pressable>
          ),
        }}
      />

      <Text variant="title">{food.name}</Text>

      <Card className="gap-4">
        <View className="gap-2">
          <Text variant="label" tone="muted">
            {t('logSearch', 'serving')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {food.servings.map((row) => {
              const isSelected = row.id === servingId;

              return (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    haptics.selection();
                    setServingId(row.id);
                    setQuantity(1);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={cn(
                    'h-10 justify-center rounded-pill border px-4',
                    isSelected ? 'border-brand bg-brand' : 'border-border bg-surface',
                  )}
                >
                  <Text variant="label" tone={isSelected ? 'onBrand' : 'default'}>
                    {row.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <Text variant="label" tone="muted">
            {t('logSearch', 'amount')}
          </Text>
          <NumberField
            compact
            label={t('logSearch', 'amount')}
            value={quantity}
            onChange={(next) => setQuantity(next ?? (isGramServing ? 10 : 0.5))}
            min={isGramServing ? 10 : 0.5}
            max={isGramServing ? 5000 : 20}
            precision={isGramServing ? 0 : 1}
          />
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-baseline justify-between">
          <Text variant="heading">{t('logIngredient', 'calories')}</Text>
          <Text variant="title">{nutrition.kcal.toLocaleString()}</Text>
        </View>
        <View className="gap-2 border-t border-border pt-3">
          <Row label={t('logIngredient', 'weight')} value={`${Math.round(grams)} g`} />
          <Row
            label={t('onboardingFinalize', 'protein')}
            value={`${nutrition.proteinG} g`}
          />
          <Row label={t('onboardingFinalize', 'carbs')} value={`${nutrition.carbsG} g`} />
          <Row label={t('onboardingFinalize', 'fat')} value={`${nutrition.fatG} g`} />
          {isPremium && nutrition.fiberG !== undefined && nutrition.fiberG !== null ? (
            <Row label={t('entryDetail', 'fiber')} value={`${nutrition.fiberG} g`} />
          ) : null}
        </View>
      </Card>

      <Button
        label={t('logSearch', 'add')}
        onPress={save}
        loading={quickLog.isPending}
        disabled={quantity <= 0}
        fullWidth
        size="lg"
      />
    </KeyboardAwareScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="mono">{value}</Text>
    </View>
  );
}
