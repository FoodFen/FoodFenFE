import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useDraftStore } from '@/features/diary/draftStore';
import { useCatalogSearch } from '@/features/diary/queries';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { nutritionForServing } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { CatalogFood } from '@/types/models';

/**
 * Add one ingredient to the meal being composed.
 *
 * Two ways in. Picking from the bundled list fills the numbers in for you and
 * is available to everyone; typing the numbers yourself is the Premium path,
 * matching the plan split in the data model. Either way the values are copied
 * onto the draft, so the catalog is only ever a starting point.
 */
export default function AddIngredientScreen() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogFood | null>(null);

  const debouncedQuery = useDebounce(query, 250);
  const search = useCatalogSearch(debouncedQuery);
  const isPremium = useIsPremium();
  const { t } = useTranslation();

  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  if (selected) {
    return (
      <PortionForm
        food={selected}
        onBack={() => setSelected(null)}
        onDone={() => router.back()}
      />
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="gap-3 px-4 pb-2 pt-3">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('logIngredient', 'searchPlaceholder')}
          autoFocus
          returnKeyType="search"
          leading={<Ionicons name="search" size={18} color={colors.fgSubtle} />}
          trailing={
            query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('logIngredient', 'clearSearchA11y')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.fgSubtle} />
              </Pressable>
            ) : null
          }
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1">
        {(search.data ?? []).map((food) => (
          <Pressable
            key={food.id}
            onPress={() => {
              haptics.selection();
              setSelected(food);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('logIngredient', 'foodA11y')
              .replace('{name}', food.name)
              .replace('{kcal}', String(food.per100g.kcal))}
            className="flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-surface-alt"
          >
            <View className="flex-1 gap-0.5">
              <Text variant="body" numberOfLines={1}>
                {food.name}
              </Text>
              <Text variant="caption" tone="muted">
                {t('logIngredient', 'kcalPer100g').replace(
                  '{kcal}',
                  String(food.per100g.kcal),
                )}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.fgSubtle} />
          </Pressable>
        ))}

        {debouncedQuery.trim().length >= 2 && (search.data ?? []).length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={t('logIngredient', 'noMatches')}
            description={t('logIngredient', 'noMatchesDescription').replace(
              '{query}',
              debouncedQuery.trim(),
            )}
          />
        ) : null}

        {debouncedQuery.trim().length < 2 ? (
          <View className="px-4 pt-2">
            <Text variant="caption" tone="subtle">
              {t('logIngredient', 'searchHint')}
            </Text>
          </View>
        ) : null}

        <View className="p-4">
          {isPremium ? (
            <ManualIngredientForm onDone={() => router.back()} />
          ) : (
            <Card className="gap-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="lock-closed" size={16} color={colors.fgMuted} />
                <Text variant="heading">{t('logIngredient', 'enterYourOwn')}</Text>
              </View>
              <Text variant="body" tone="muted">
                {t('logIngredient', 'premiumHint')}
              </Text>
              <Button
                label={t('profile', 'upgradeToPremium')}
                onPress={() => router.push('/premium')}
                variant="secondary"
                size="sm"
              />
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Choose how much of a catalog food was eaten. */
function PortionForm({
  food,
  onBack,
  onDone,
}: {
  food: CatalogFood;
  onBack: () => void;
  onDone: () => void;
}) {
  const addIngredient = useDraftStore((state) => state.addIngredient);
  const isPremium = useIsPremium();
  const { t } = useTranslation();

  const [quantityText, setQuantityText] = useState('1');
  const [servingId, setServingId] = useState(food.servings[0]?.id ?? '');

  // A half-typed value ("1.") must not blank the preview, so anything
  // unparseable reads as zero rather than NaN.
  const quantity = useMemo(() => {
    const parsed = Number(quantityText.replace(',', '.'));

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [quantityText]);

  const serving = food.servings.find((row) => row.id === servingId) ?? food.servings[0];
  const grams = serving ? quantity * serving.grams : quantity;
  const nutrition = nutritionForServing(food, quantity, servingId);

  const add = () => {
    haptics.success();
    addIngredient({
      name: food.name,
      quantityG: grams,
      kcal: nutrition.kcal,
      carbsG: nutrition.carbsG,
      proteinG: nutrition.proteinG,
      fatG: nutrition.fatG,
      fiberG: nutrition.fiberG ?? null,
      catalogFoodId: food.id,
    });
    onDone();
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        className="flex-row items-center gap-1 active:opacity-60"
      >
        <Text variant="label" tone="brand">
          {t('logIngredient', 'backToSearch')}
        </Text>
      </Pressable>

      <Text variant="title">{food.name}</Text>

      <Card className="gap-4">
        <Input
          label={t('logIngredient', 'amount')}
          value={quantityText}
          onChangeText={setQuantityText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          error={
            quantity === 0 && quantityText !== ''
              ? t('logIngredient', 'amountError')
              : undefined
          }
        />

        <View className="gap-2">
          <Text variant="label" tone="muted">
            {t('logIngredient', 'serving')}
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
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-baseline justify-between">
          <Text variant="heading">{t('logIngredient', 'calories')}</Text>
          <Text variant="title">{nutrition.kcal.toLocaleString()}</Text>
        </View>

        <View className="gap-2 border-t border-border pt-3">
          <Row label={t('logIngredient', 'weight')} value={`${Math.round(grams)} g`} />
          <Row label={t('onboardingFinalize', 'protein')} value={`${nutrition.proteinG} g`} />
          <Row label={t('onboardingFinalize', 'carbs')} value={`${nutrition.carbsG} g`} />
          <Row label={t('onboardingFinalize', 'fat')} value={`${nutrition.fatG} g`} />
          {isPremium && nutrition.fiberG !== undefined && nutrition.fiberG !== null ? (
            <Row label={t('entryDetail', 'fiber')} value={`${nutrition.fiberG} g`} />
          ) : null}
        </View>
      </Card>

      <Button
        label={t('logIngredient', 'addToMeal')}
        onPress={add}
        disabled={quantity === 0}
        fullWidth
        size="lg"
      />
    </KeyboardAwareScrollView>
  );
}

/** The Premium path: type an ingredient's numbers directly. */
function ManualIngredientForm({ onDone }: { onDone: () => void }) {
  const addIngredient = useDraftStore((state) => state.addIngredient);
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [kcal, setKcal] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');

  const toNumber = (value: string): number => {
    const parsed = Number(value.replace(',', '.'));

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  const canAdd = name.trim().length > 0 && toNumber(kcal) > 0;

  const add = () => {
    haptics.success();
    addIngredient({
      name: name.trim(),
      quantityG: toNumber(grams),
      kcal: Math.round(toNumber(kcal)),
      carbsG: toNumber(carbsG),
      proteinG: toNumber(proteinG),
      fatG: toNumber(fatG),
      fiberG: null,
      catalogFoodId: null,
    });
    onDone();
  };

  return (
    <Card className="gap-4">
      <Text variant="heading">{t('logIngredient', 'enterYourOwn')}</Text>

      <Input
        label={t('common', 'name')}
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
      />

      <View className="flex-row gap-3">
        <Input
          containerClassName="flex-1"
          label={t('logIngredient', 'weightGrams')}
          value={grams}
          onChangeText={setGrams}
          keyboardType="decimal-pad"
        />
        <Input
          containerClassName="flex-1"
          label={t('logIngredient', 'calories')}
          value={kcal}
          onChangeText={setKcal}
          keyboardType="number-pad"
        />
      </View>

      <View className="flex-row gap-3">
        <Input
          containerClassName="flex-1"
          label={t('onboardingFinalize', 'protein')}
          value={proteinG}
          onChangeText={setProteinG}
          keyboardType="decimal-pad"
        />
        <Input
          containerClassName="flex-1"
          label={t('onboardingFinalize', 'carbs')}
          value={carbsG}
          onChangeText={setCarbsG}
          keyboardType="decimal-pad"
        />
        <Input
          containerClassName="flex-1"
          label={t('onboardingFinalize', 'fat')}
          value={fatG}
          onChangeText={setFatG}
          keyboardType="decimal-pad"
        />
      </View>

      <Button label={t('logIngredient', 'addToMeal')} onPress={add} disabled={!canAdd} fullWidth />
    </Card>
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
