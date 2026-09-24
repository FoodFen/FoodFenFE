import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Pressable, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/errors';
import type { RemoteAiFoodAnalysisResponse } from '@/api/schemas';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { NumberField } from '@/components/ui/NumberField';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { useDraftStore } from '@/features/diary/draftStore';
import { foodEmojiFor } from '@/features/diary/foodEmoji';
import {
  useAnalyzeFood,
  useCatalogSearch,
  useLogManualEntry,
} from '@/features/diary/queries';
import { manualEntrySchema } from '@/features/diary/schemas';
import { suggestedMealType } from '@/features/diary/selectors';
import { dismissLogFlow, usePostLogInterstitial } from '@/features/gamification/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { macrosReconcile, nutritionForServing } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { CatalogFood, InputMethod } from '@/types/models';

/**
 * Manual detailed food entry (UC-12).
 *
 * The user types the final aggregate numbers — name, amount label, calories and
 * the three macros — logged as one `input_method: 'manual'` `food_entry` with
 * no ingredient breakdown. Typing the name shows a floating catalog list;
 * picking one prefills every field from its default serving, all editable. The
 * kcal-vs-macros check is a soft note.
 *
 * The Image tab and the Describe tab both send their input to the backend AI
 * (`useAnalyzeFood`) and get back itemized ingredient rows, which are pushed
 * into `useDraftStore` and handed off to the meal composer
 * (`app/log/meal.tsx`) for the user to review and save — the AI never writes
 * a `food_entry` directly. Describe covers typing a one-sentence description
 * ("a bowl of beef pho") today; voice input reusing the same tab (speak, then
 * convert to that same text field) isn't built yet.
 */

type AmountUnit = 'g' | 'serving';
type CaptureMode = 'manual' | 'image' | 'describe';
const MAX_SUGGESTIONS = 8;

/** A failed AI call surfaces the same way every other API failure does. */
function analyzeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.userMessage : fallback;
}

/**
 * Seed a fresh meal draft from an AI analysis and hand off to the composer.
 *
 * `catalogFoodId` stays null — these rows came from the model, not the
 * bundled catalog. `confidence` rides along on the draft row so the composer
 * can flag an uncertain guess, but `DraftIngredient` is the only place it
 * lives — `IngredientInput` (what `useLogMeal` actually persists) has no such
 * field, so it never reaches the database.
 */
function applyAnalysisToDraft(
  result: RemoteAiFoodAnalysisResponse,
  inputMethod: InputMethod,
): void {
  const draft = useDraftStore.getState();
  draft.start(todayKey(), suggestedMealType());

  for (const ing of result.ingredients) {
    draft.addIngredient({
      name: ing.name,
      quantityG: ing.quantityG,
      kcal: ing.kcal,
      carbsG: ing.carbsG,
      proteinG: ing.proteinG,
      fatG: ing.fatG,
      fiberG: ing.fiberG ?? null,
      catalogFoodId: null,
      confidence: ing.confidence,
    });
  }

  useDraftStore.setState({
    name: result.mealName,
    inputMethod,
    imageUrl: result.imageUrl ?? null,
  });

  router.replace('/log/meal');
}

export default function ManualEntryScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();

  const logManual = useLogManualEntry();
  const finishLogging = usePostLogInterstitial(dismissLogFlow);
  const analyzeFood = useAnalyzeFood();

  const session = useAuthStore((state) => state.session);
  const aiAvailable = canUseRemote();
  // The one `canUseRemote()` reason worth its own affordance: everything else
  // about the build/connection is fine, only signing in is missing (mirrors
  // `app/chat.tsx`'s gating).
  const isNoSessionReason = env.hasBackend && onlineManager.isOnline() && !session;

  const [captureMode, setCaptureMode] = useState<CaptureMode>(
    params.mode === 'image' ? 'image' : 'manual',
  );
  const [pickedImage, setPickedImage] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [smartText, setSmartText] = useState('');

  const pickImage = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });

    if (result.canceled || !result.assets[0]) return;
    haptics.selection();
    setPickedImage(result.assets[0]);
  };

  const analyzeImage = () => {
    if (!pickedImage || analyzeFood.isPending) return;

    analyzeFood.mutate(
      {
        type: 'image',
        uri: pickedImage.uri,
        fileName: pickedImage.fileName ?? 'photo.jpg',
        mimeType: pickedImage.mimeType ?? 'image/jpeg',
      },
      {
        onSuccess: (result) => {
          haptics.success();
          applyAnalysisToDraft(result, 'image');
        },
        onError: (error) => {
          haptics.error();
          Alert.alert(
            t('logManual', 'aiErrorTitle'),
            analyzeErrorMessage(error, t('logManual', 'aiErrorFallback')),
          );
        },
      },
    );
  };

  const analyzeSmartText = () => {
    const description = smartText.trim();
    if (!description || analyzeFood.isPending) return;

    analyzeFood.mutate(
      { type: 'text', description },
      {
        onSuccess: (result) => {
          haptics.success();
          applyAnalysisToDraft(result, 'type');
        },
        onError: (error) => {
          haptics.error();
          Alert.alert(
            t('logManual', 'aiErrorTitle'),
            analyzeErrorMessage(error, t('logManual', 'aiErrorFallback')),
          );
        },
      },
    );
  };

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

      {captureMode === 'image' ? (
        aiAvailable ? (
          <ImageCapturePanel
            image={pickedImage}
            isAnalyzing={analyzeFood.isPending}
            onPick={pickImage}
            onAnalyze={analyzeImage}
            onClear={() => setPickedImage(null)}
          />
        ) : (
          <View className="flex-1 justify-center">
            <EmptyState
              icon="⚠️"
              title={t('logManual', 'aiUnavailableTitle')}
              description={t('logManual', 'aiUnavailableDescription')}
              actionLabel={isNoSessionReason ? t('logManual', 'aiSignIn') : undefined}
              onAction={isNoSessionReason ? () => router.push('/sign-in') : undefined}
            />
          </View>
        )
      ) : captureMode === 'describe' ? (
        aiAvailable ? (
          <DescribePanel
            text={smartText}
            onChangeText={setSmartText}
            onAnalyze={analyzeSmartText}
            isAnalyzing={analyzeFood.isPending}
          />
        ) : (
          <View className="flex-1 justify-center">
            <EmptyState
              icon="⚠️"
              title={t('logManual', 'aiUnavailableTitle')}
              description={t('logManual', 'aiUnavailableDescription')}
              actionLabel={isNoSessionReason ? t('logManual', 'aiSignIn') : undefined}
              onAction={isNoSessionReason ? () => router.push('/sign-in') : undefined}
            />
          </View>
        )
      ) : (
        <>
          <View className="relative z-20 flex-row items-center gap-2 px-4 pt-1">
            <TextInput
              value={emoji ?? foodEmojiFor({ name, mealType: suggestedMealType() })}
              onChangeText={(next) => setEmoji(next)}
              selectTextOnFocus
              accessibilityLabel={t('logManual', 'chooseEmojiA11y')}
              className="h-11 w-11 rounded-card border border-border bg-surface text-center text-2xl"
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
                className="absolute inset-x-4 top-14 overflow-hidden rounded-card border border-border bg-surface"
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
        </>
      )}

      <View
        style={{ paddingBottom: insets.bottom + 10 }}
        className="flex-row justify-center gap-8 border-t border-border pt-3"
      >
        <ModeTab
          label={t('logManual', 'modeDescribe')}
          active={captureMode === 'describe'}
          onPress={() => setCaptureMode('describe')}
        />
        <ModeTab
          label={t('logManual', 'modeImage')}
          active={captureMode === 'image'}
          onPress={() => setCaptureMode('image')}
        />
        <ModeTab
          label={t('logManual', 'modeManual')}
          active={captureMode === 'manual'}
          onPress={() => setCaptureMode('manual')}
        />
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

function ModeTab({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className="items-center gap-1 rounded-card px-3 py-3 active:bg-surface-alt"
    >
      <Text variant="label" tone={active ? 'brand' : 'subtle'}>
        {label}
      </Text>
      <View
        className={cn('h-0.5 w-6 rounded-full', active ? 'bg-brand' : 'bg-transparent')}
      />
    </Pressable>
  );
}

/** The Image mode's whole-screen content: pick a photo, preview it, analyze. */
function ImageCapturePanel({
  image,
  isAnalyzing,
  onPick,
  onAnalyze,
  onClear,
}: {
  image: ImagePicker.ImagePickerAsset | null;
  isAnalyzing: boolean;
  onPick: (source: 'camera' | 'library') => void;
  onAnalyze: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className="flex-1 justify-center gap-6 p-6">
      {image ? (
        <View className="gap-4">
          <Image
            source={{ uri: image.uri }}
            className="aspect-square w-full rounded-card"
            resizeMode="cover"
          />
          <Button
            label={t('logManual', 'aiAnalyzePhoto')}
            onPress={onAnalyze}
            loading={isAnalyzing}
            fullWidth
            size="lg"
          />
          <Button
            label={t('logManual', 'aiRetakePhoto')}
            onPress={onClear}
            variant="secondary"
            disabled={isAnalyzing}
            fullWidth
          />
        </View>
      ) : (
        <View className="gap-4">
          <View className="items-center gap-2 pb-2">
            <Ionicons name="camera-outline" size={40} color={colors.fgSubtle} />
            <Text variant="body" tone="muted" className="text-center">
              {t('logManual', 'aiImageHint')}
            </Text>
          </View>
          <Button
            label={t('logManual', 'aiTakePhoto')}
            onPress={() => onPick('camera')}
            leading={<Ionicons name="camera" size={18} color={colors.onBrand} />}
            fullWidth
            size="lg"
          />
          <Button
            label={t('logManual', 'aiChooseFromLibrary')}
            onPress={() => onPick('library')}
            variant="secondary"
            leading={<Ionicons name="images-outline" size={18} color={colors.fg} />}
            fullWidth
          />
        </View>
      )}
    </View>
  );
}

/**
 * The Describe mode's whole-screen content: a one-sentence description in,
 * itemized ingredients out. Voice input isn't built yet — speaking would
 * just fill this same text field via speech-to-text, not add a separate
 * flow, so there's nothing here to gate on that today.
 */
function DescribePanel({
  text,
  onChangeText,
  onAnalyze,
  isAnalyzing,
}: {
  text: string;
  onChangeText: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <View className="flex-1 justify-center gap-6 p-6">
      <View className="items-center gap-2 pb-2">
        <Ionicons name="sparkles-outline" size={40} color={colors.fgSubtle} />
        <Text variant="body" tone="muted" className="text-center">
          {t('logManual', 'describeHint')}
        </Text>
      </View>
      <Input
        value={text}
        onChangeText={onChangeText}
        placeholder={t('logManual', 'smartEntryPlaceholder')}
        autoCapitalize="sentences"
        returnKeyType="done"
        autoFocus
      />
      <Button
        label={t('logManual', 'smartEntryAnalyze')}
        onPress={onAnalyze}
        loading={isAnalyzing}
        disabled={text.trim().length === 0}
        fullWidth
        size="lg"
      />
    </View>
  );
}
