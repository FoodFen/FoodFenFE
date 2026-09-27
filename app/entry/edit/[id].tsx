import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { NumberField } from '@/components/ui/NumberField';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { foodEmojiFor } from '@/features/diary/foodEmoji';
import { useEntry, useUpdateEntry, useUpdateManualEntry } from '@/features/diary/queries';
import { MEAL_ICONS } from '@/features/diary/selectors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { macrosReconcile } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { FoodEntry, MealType } from '@/types/models';
import { MEAL_TYPES } from '@/types/models';

/**
 * Edit a logged entry.
 *
 * The form edits the aggregate — name, meal, calories and the three macros.
 * A manual entry (no ingredients) saves straight to the header columns; an
 * entry with one ingredient rewrites that row so the totals re-derive. An
 * entry with several ingredients only allows name and meal here.
 */
export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: entry, isPending, error, refetch } = useEntry(id);

  if (isPending) {
    return (
      <View className="flex-1 gap-4 bg-bg p-4">
        <Skeleton className="h-12 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </View>
    );
  }

  if (error || !entry) {
    return (
      <ErrorState
        description={error instanceof Error ? error.message : t('entryEdit', 'loadError')}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('entryEdit', 'layoutTitle') }} />
      <EditForm entry={entry} />
    </>
  );
}

function EditForm({ entry }: { entry: FoodEntry }) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const updateManual = useUpdateManualEntry();
  const updateEntry = useUpdateEntry();

  const numbersEditable = entry.ingredients.length <= 1;

  const [name, setName] = useState(entry.name);
  const [emoji, setEmoji] = useState<string | null>(entry.emoji);
  const [mealType, setMealType] = useState<MealType>(entry.mealType);
  const [kcal, setKcal] = useState<number | null>(entry.totalKcal);
  const [carbsG, setCarbsG] = useState<number | null>(entry.carbsG);
  const [proteinG, setProteinG] = useState<number | null>(entry.proteinG);
  const [fatG, setFatG] = useState<number | null>(entry.fatG);

  const macrosPresent = carbsG !== null && proteinG !== null && fatG !== null;
  const canSave =
    name.trim().length > 0 &&
    (!numbersEditable || (kcal !== null && kcal > 0 && macrosPresent));

  const showWarning = useMemo(
    () =>
      numbersEditable &&
      kcal !== null &&
      macrosPresent &&
      !macrosReconcile(kcal, {
        carbsG: carbsG ?? 0,
        proteinG: proteinG ?? 0,
        fatG: fatG ?? 0,
      }),
    [numbersEditable, kcal, macrosPresent, carbsG, proteinG, fatG],
  );

  const isPending = updateManual.isPending || updateEntry.isPending;

  const done = () => {
    haptics.success();
    router.back();
  };

  const fail = (err: unknown) => {
    haptics.error();
    Alert.alert(
      t('entryEdit', 'saveErrorTitle'),
      err instanceof Error ? err.message : t('entryEdit', 'saveErrorFallback'),
    );
  };

  const save = () => {
    if (!canSave) return;
    const trimmedName = name.trim();
    const emojiPatch = emoji && emoji.length > 0 ? emoji : null;

    if (entry.ingredients.length === 0) {
      updateManual.mutate(
        {
          id: entry.id,
          patch: {
            name: trimmedName,
            emoji: emojiPatch,
            mealType,
            totalKcal: kcal ?? 0,
            carbsG: carbsG ?? 0,
            proteinG: proteinG ?? 0,
            fatG: fatG ?? 0,
          },
        },
        { onSuccess: done, onError: fail },
      );
      return;
    }

    if (entry.ingredients.length === 1) {
      const row = entry.ingredients[0];

      updateEntry.mutate(
        {
          id: entry.id,
          patch: {
            name: trimmedName,
            emoji: emojiPatch,
            mealType,
            ingredients: [
              {
                name: row?.name ?? trimmedName,
                quantityG: row?.quantityG ?? 0,
                kcal: kcal ?? 0,
                carbsG: carbsG ?? 0,
                proteinG: proteinG ?? 0,
                fatG: fatG ?? 0,
                fiberG: row?.fiberG ?? null,
                catalogFoodId: row?.catalogFoodId ?? null,
              },
            ],
          },
        },
        { onSuccess: done, onError: fail },
      );
      return;
    }

    updateEntry.mutate(
      { id: entry.id, patch: { name: trimmedName, emoji: emojiPatch, mealType } },
      { onSuccess: done, onError: fail },
    );
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="gap-1.5">
        <Text variant="label" tone="muted">
          {t('entryEdit', 'name')}
        </Text>
        <View className="flex-row gap-2">
          <TextInput
            value={emoji ?? foodEmojiFor({ name, mealType })}
            onChangeText={setEmoji}
            selectTextOnFocus
            accessibilityLabel={t('logManual', 'chooseEmojiA11y')}
            className="h-12 w-12 rounded-card border border-border bg-surface text-center text-2xl"
          />
          <TextInput
            className="h-12 flex-1 rounded-card border border-border bg-surface px-3 font-sans text-base text-fg"
            value={name}
            onChangeText={setName}
            placeholder={t('entryEdit', 'name')}
            placeholderTextColor={colors.fgSubtle}
            autoCapitalize="sentences"
          />
        </View>
      </View>

      <View className="gap-1.5">
        <Text variant="label" tone="muted">
          {t('entryEdit', 'mealType')}
        </Text>
        <View className="flex-row gap-2">
          {MEAL_TYPES.map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                haptics.selection();
                setMealType(m);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: mealType === m }}
              className={cn(
                'flex-1 items-center gap-0.5 rounded-card border py-2',
                mealType === m
                  ? 'border-brand bg-brand-soft'
                  : 'border-border bg-surface',
              )}
            >
              <Text className="text-base">{MEAL_ICONS[m]}</Text>
              <Text variant="caption" tone={mealType === m ? 'brand' : 'muted'}>
                {t('mealType', m)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {numbersEditable ? (
        <>
          <View className="flex-row items-center justify-between">
            <Text variant="label" tone="muted">
              {t('entryEdit', 'calories')}
            </Text>
            <NumberField
              compact
              value={kcal}
              onChange={setKcal}
              min={0}
              max={20000}
              precision={0}
              placeholder="0"
            />
          </View>

          <View className="gap-1">
            <Text variant="caption" tone="subtle">
              {t('entryEdit', 'macros')}
            </Text>
            <MacroRow
              label={`🌾  ${t('entryEdit', 'carbs')}`}
              value={carbsG}
              onChange={setCarbsG}
            />
            <MacroRow
              label={`🥩  ${t('entryEdit', 'protein')}`}
              value={proteinG}
              onChange={setProteinG}
            />
            <MacroRow
              label={`🥑  ${t('entryEdit', 'fat')}`}
              value={fatG}
              onChange={setFatG}
            />
            {showWarning ? (
              <Text variant="caption" tone="warning">
                {t('entryEdit', 'reconcileWarning')}
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <Text variant="caption" tone="subtle">
          {t('entryEdit', 'multiIngredientNote')}
        </Text>
      )}

      <Button
        label={t('entryEdit', 'save')}
        onPress={save}
        disabled={!canSave}
        loading={isPending}
        fullWidth
        size="lg"
      />
    </KeyboardAwareScrollView>
  );
}

function MacroRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text variant="body">{label}</Text>
      <NumberField
        compact
        value={value}
        onChange={onChange}
        min={0}
        max={2000}
        precision={1}
        placeholder="0"
      />
    </View>
  );
}
