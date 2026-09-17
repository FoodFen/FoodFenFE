import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/NumberField';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { foodEmojiFor } from '@/features/diary/foodEmoji';
import { useCatalogSearch, useLogManualEntry } from '@/features/diary/queries';
import { manualEntrySchema } from '@/features/diary/schemas';
import { suggestedMealType } from '@/features/diary/selectors';
import { dismissLogFlow, usePostLogInterstitial } from '@/features/gamification/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { macrosReconcile, nutritionForServing } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { CatalogFood } from '@/types/models';

/**
 * Manual detailed food entry (UC-12).
 *
 * The user types the final aggregate numbers — name, amount label, calories and
 * the three macros — logged as one `input_method: 'manual'` `food_entry` with
 * no ingredient breakdown. Typing the name shows a floating catalog list;
 * picking one prefills every field from its default serving, all editable. The
 * kcal-vs-macros check is a soft note. The smart one-sentence (AI) path is an
 * inert "coming soon" affordance.
 */

type AmountUnit = 'g' | 'serving';
const MAX_SUGGESTIONS = 8;

export default function ManualEntryScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const insets = useSafeAreaInsets();

  const logManual = useLogManualEntry();
  const finishLogging = usePostLogInterstitial(dismissLogFlow);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const [amount, setAmount] = useState<number | null>(null);
  const [amountUnit, setAmountUnit] = useState<AmountUnit>('g');
  const [kcal, setKcal] = useState<number | null>(null);
  const [carbsG, setCarbsG] = useState<number | null>(null);
  const [proteinG, setProteinG] = useState<number | null>(null);
  const [fatG, setFatG] = useState<number | null>(null);

  const debouncedName = useDebounce(name, 250);
  const search = useCatalogSearch(debouncedName);
  const suggestions = (search.data ?? []).slice(0, MAX_SUGGESTIONS);
  const showSuggestions =
    nameFocused && debouncedName.trim().length >= 2 && suggestions.length > 0;

  const macrosPresent = carbsG !== null && proteinG !== null && fatG !== null;

  const parsed = useMemo(
    () =>
      manualEntrySchema.safeParse({
        name,
        amount,
        amountUnit,
        kcal,
        carbsG,
        proteinG,
        fatG,
      }),
    [name, amount, amountUnit, kcal, carbsG, proteinG, fatG],
  );

  const canSave =
    name.trim().length > 0 && kcal !== null && macrosPresent && parsed.success;

  const showWarning =
    kcal !== null && macrosPresent && !macrosReconcile(kcal, { carbsG, proteinG, fatG });

  const pickSuggestion = (food: CatalogFood) => {
    haptics.selection();
    if (blurTimer.current) clearTimeout(blurTimer.current);

    const servingId =
      food.servings.find((s) => s.default)?.id ?? food.servings[0]?.id ?? '';
    const serving = food.servings.find((s) => s.id === servingId);
    const n = nutritionForServing(food, 1, servingId);

    setName(food.name);
    setAmount(serving ? Math.round(serving.grams) : null);
    setAmountUnit('g');
    setKcal(n.kcal);
    setCarbsG(n.carbsG);
    setProteinG(n.proteinG);
    setFatG(n.fatG);
    setNameFocused(false);
    Keyboard.dismiss();
  };

  const save = () => {
    if (!parsed.success || logManual.isPending) return;
    const v = parsed.data;

    logManual.mutate(
      {
        name: v.name,
        emoji: emoji && emoji.length > 0 ? emoji : null,
        mealType: suggestedMealType(),
        loggedOn: todayKey(),
        amount: v.amount,
        amountUnit: v.amountUnit,
        totalKcal: v.kcal,
        carbsG: v.carbsG,
        proteinG: v.proteinG,
        fatG: v.fatG,
      },
      {
        onSuccess: () => {
          haptics.success();
          finishLogging();
        },
        onError: (error) => {
          haptics.error();
          Alert.alert(
            t('logManual', 'saveErrorTitle'),
            error instanceof Error ? error.message : t('logManual', 'saveErrorFallback'),
          );
        },
      },
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        title="FoodFen"
        icon="close"
        onPress={() => router.dismiss()}
        accessibilityLabel={t('common', 'cancel')}
      />

      <View className="relative z-20 flex-row items-center gap-2 px-4 pt-1">
        <TextInput
          value={emoji ?? foodEmojiFor({ name, mealType: suggestedMealType() })}
          onChangeText={(next) => setEmoji(next)}
          selectTextOnFocus
          accessibilityLabel={t('logManual', 'chooseEmojiA11y')}
          className="h-11 w-11 rounded-xl border border-border bg-surface text-center text-2xl"
        />

        <TextInput
          className="flex-1 font-bold font-sans text-3xl text-fg"
          value={name}
          onChangeText={setName}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setNameFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setNameFocused(false), 120);
          }}
          placeholder={t('logManual', 'mealName')}
          placeholderTextColor={colors.fgSubtle}
          autoCapitalize="sentences"
          autoFocus
          accessibilityLabel={t('logManual', 'mealName')}
        />

        {showSuggestions ? (
          <View
            style={{ elevation: 8 }}
            accessibilityLabel={t('logManual', 'suggestionsA11y')}
            className="absolute inset-x-4 top-14 overflow-hidden rounded-xl border border-border bg-surface"
          >
            <ScrollView
              style={{ maxHeight: 176 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {suggestions.map((food, index) => (
                <Pressable
                  key={food.id}
                  onPress={() => pickSuggestion(food)}
                  accessibilityRole="button"
                  accessibilityLabel={t('logManual', 'pickSuggestionA11y').replace(
                    '{name}',
                    food.name,
                  )}
                  className={cn(
                    'px-3 py-3 active:bg-surface-alt',
                    index > 0 && 'border-t border-border',
                  )}
                >
                  <Text variant="body" numberOfLines={1}>
                    {food.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          className="flex-row items-center gap-2 opacity-40"
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.fgSubtle} />
          <Text variant="caption" tone="subtle" className="flex-1">
            {t('logManual', 'smartEntry')}
          </Text>
          <Text variant="caption" tone="subtle">
            {t('logManual', 'comingSoon')}
          </Text>
        </Pressable>

        <Field label={t('logManual', 'amountEaten')}>
          <View className="flex-row items-center gap-2">
            <UnitPill
              label={t('logManual', 'grams')}
              selected={amountUnit === 'g'}
              onPress={() => setAmountUnit('g')}
            />
            <UnitPill
              label={t('logManual', 'serving')}
              selected={amountUnit === 'serving'}
              onPress={() => setAmountUnit('serving')}
            />
            <NumberField
              compact
              value={amount}
              onChange={setAmount}
              min={0}
              max={amountUnit === 'g' ? 5000 : 50}
              precision={amountUnit === 'g' ? 0 : 1}
              placeholder="0"
            />
          </View>
        </Field>

        <View className="gap-1">
          <Field label={t('logManual', 'calories')}>
            <NumberField
              compact
              value={kcal}
              onChange={setKcal}
              min={0}
              max={20000}
              precision={0}
              placeholder="0"
            />
          </Field>
          {showWarning ? (
            <Text variant="caption" tone="warning">
              {t('logManual', 'reconcileWarning')}
            </Text>
          ) : null}
        </View>

        <View className="gap-1">
          <Text variant="caption" tone="subtle">
            {t('logManual', 'macros')}
          </Text>
          <MacroRow
            label={`🌾  ${t('logManual', 'carbs')}`}
            value={carbsG}
            onChange={setCarbsG}
          />
          <MacroRow
            label={`🥩  ${t('logManual', 'protein')}`}
            value={proteinG}
            onChange={setProteinG}
          />
          <MacroRow
            label={`🥑  ${t('logManual', 'fat')}`}
            value={fatG}
            onChange={setFatG}
          />
        </View>

        <Button
          label={t('logManual', 'save')}
          onPress={save}
          disabled={!canSave}
          loading={logManual.isPending}
          fullWidth
          size="lg"
        />
      </KeyboardAwareScrollView>

      <View
        style={{ paddingBottom: insets.bottom + 10 }}
        className="flex-row justify-center gap-8 border-t border-border pt-3"
      >
        <ModeTab label={t('logManual', 'modeVoice')} />
        <ModeTab label={t('logManual', 'modeImage')} />
        <ModeTab label={t('logManual', 'modeManual')} active />
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </View>
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

function UnitPill({
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
        'h-9 justify-center rounded-pill border px-3',
        selected ? 'border-brand bg-brand' : 'border-border bg-surface',
      )}
    >
      <Text variant="caption" tone={selected ? 'onBrand' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModeTab({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled: !active }}
      className="items-center gap-1"
    >
      <Text variant="label" tone={active ? 'brand' : 'subtle'}>
        {label}
      </Text>
      <View
        className={cn('h-0.5 w-6 rounded-full', active ? 'bg-brand' : 'bg-transparent')}
      />
    </View>
  );
}
