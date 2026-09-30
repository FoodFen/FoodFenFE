import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { foodEmojiFor } from '@/features/diary/foodEmoji';
import { useDeleteEntry, useEntry, useUpdateEntry } from '@/features/diary/queries';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { formatDiaryDate, formatTime } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { macroEnergyShare } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { AiFeedback } from '@/types/models';

/** A logged meal: what it was made of, and what it came to. */
export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: entry, isPending, error, refetch } = useEntry(id);

  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const isPremium = useIsPremium();
  const { t } = useTranslation();

  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  if (isPending) {
    return (
      <View className="flex-1 gap-4 bg-bg p-4">
        <Skeleton className="h-20 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </View>
    );
  }

  if (error || !entry) {
    return (
      <ErrorState
        description={
          error instanceof Error ? error.message : t('entryDetail', 'loadError')
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const share = macroEnergyShare(entry);
  const totalG = entry.ingredients.reduce((sum, row) => sum + row.quantityG, 0);

  const setFeedback = (feedback: AiFeedback) => {
    haptics.selection();
    // Tapping the active thumb clears it, so a mis-tap is undoable.
    updateEntry.mutate({
      id: entry.id,
      patch: { aiFeedback: entry.aiFeedback === feedback ? null : feedback },
    });
  };

  const confirmDelete = () => {
    Alert.alert(entry.name, t('entryDetail', 'deleteConfirmMessage'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      {
        text: t('common', 'delete'),
        style: 'destructive',
        onPress: () => {
          deleteEntry.mutate(
            { id: entry.id },
            {
              onSuccess: () => {
                haptics.success();
                router.back();
              },
            },
          );
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: entry.name }} />

      <ScrollScreen>
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text variant="title">{entry.name}</Text>
            <Text variant="body" tone="muted">
              {t('mealType', entry.mealType)} · {formatDiaryDate(entry.loggedOn)}{' '}
              {t('entryDetail', 'at')} {formatTime(entry.loggedAt)}
            </Text>
          </View>

          {entry.imageUrl ? (
            <Image
              source={{ uri: entry.imageUrl }}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 96,
                height: 96,
                borderRadius: 16,
                backgroundColor: colors.surfaceAlt,
              }}
              contentFit="cover"
            />
          ) : (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="h-24 w-24 items-center justify-center rounded-card bg-surface-alt"
            >
              <Text style={{ fontSize: 44 }}>{foodEmojiFor(entry)}</Text>
            </View>
          )}
        </View>

        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text variant="heading">{t('entryDetail', 'caloriesMacros')}</Text>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/entry/edit/[id]', params: { id: entry.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={t('entryDetail', 'edit')}
              className="-mr-2 flex-row items-center gap-1 rounded-card px-2 py-1 active:bg-surface-alt"
            >
              <Ionicons name="pencil" size={13} color={colors.brand} />
              <Text variant="label" tone="brand">
                {t('entryDetail', 'edit')}
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-baseline justify-between">
            {totalG > 0 ? (
              <View className="flex-row items-baseline gap-1">
                <Text variant="title">{Math.round(totalG).toLocaleString()}</Text>
                <Text variant="body" tone="muted">
                  g
                </Text>
              </View>
            ) : (
              <Text variant="body" tone="muted">
                {t('entryDetail', 'total')}
              </Text>
            )}
            <View className="flex-row items-baseline gap-1">
              <Text variant="title">{entry.totalKcal.toLocaleString()}</Text>
              <Text variant="body" tone="muted">
                kcal
              </Text>
            </View>
          </View>

          <View className="h-2.5 flex-row overflow-hidden rounded-pill bg-surface-alt">
            <View className="h-full bg-carbs" style={{ width: `${share.carbsG * 100}%` }} />
            <View
              className="h-full bg-protein"
              style={{ width: `${share.proteinG * 100}%` }}
            />
            <View className="h-full bg-fat" style={{ width: `${share.fatG * 100}%` }} />
          </View>

          <View className="flex-row justify-between">
            <MacroLegendItem
              colorClassName="bg-carbs"
              label={t('onboardingFinalize', 'carbs')}
              value={`${entry.carbsG}g`}
            />
            <MacroLegendItem
              colorClassName="bg-protein"
              label={t('onboardingFinalize', 'protein')}
              value={`${entry.proteinG}g`}
            />
            <MacroLegendItem
              colorClassName="bg-fat"
              label={t('onboardingFinalize', 'fat')}
              value={`${entry.fatG}g`}
            />
          </View>

          {entry.fiberG !== null ? (
            <View className="gap-2 border-t border-border pt-3">
              {isPremium ? (
                <NutrientRow
                  label={t('entryDetail', 'fiber')}
                  value={`${entry.fiberG} g`}
                />
              ) : (
                <Pressable
                  onPress={() => router.push('/premium')}
                  accessibilityRole="button"
                  className="flex-row items-center justify-between active:opacity-70"
                >
                  <Text variant="body" tone="muted">
                    {t('entryDetail', 'fiber')}
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="lock-closed" size={12} color={colors.brand} />
                    <Text variant="caption" tone="brand">
                      {t('common', 'premium')}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          ) : null}
        </Card>

        <Card flush className="overflow-hidden">
          <View className="px-4 pb-2 pt-4">
            <Text variant="heading">{t('entryDetail', 'ingredients')}</Text>
          </View>

          {entry.ingredients.length === 0 ? (
            <View className="px-4 pb-4">
              <Text variant="body" tone="subtle">
                {t('entryDetail', 'noBreakdown')}
              </Text>
            </View>
          ) : (
            <View className="border-t border-border">
              {entry.ingredients.map((row) => (
                <View
                  key={row.id}
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
                </View>
              ))}
            </View>
          )}
        </Card>

        {entry.inputMethod === 'voice' || entry.inputMethod === 'image' ? (
          <Card className="gap-3">
            <Text variant="heading">{t('entryDetail', 'wasThisRight')}</Text>
            <Text variant="body" tone="muted">
              {t('entryDetail', 'aiFeedbackHint')}
            </Text>

            <View className="flex-row gap-2">
              <FeedbackButton
                icon="thumbs-up"
                label={t('entryDetail', 'looksRight')}
                active={entry.aiFeedback === 'up'}
                onPress={() => setFeedback('up')}
              />
              <FeedbackButton
                icon="thumbs-down"
                label={t('entryDetail', 'notQuite')}
                active={entry.aiFeedback === 'down'}
                onPress={() => setFeedback('down')}
              />
            </View>
          </Card>
        ) : null}

        <Button
          label={t('entryDetail', 'deleteMealButton')}
          variant="danger"
          fullWidth
          onPress={confirmDelete}
          loading={deleteEntry.isPending}
        />
      </ScrollScreen>
    </>
  );
}

function FeedbackButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: 'thumbs-up' | 'thumbs-down';
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      className={cn(
        'h-11 flex-1 flex-row items-center justify-center gap-2 rounded-card border',
        active ? 'border-brand bg-brand-soft' : 'border-border bg-surface',
      )}
    >
      <Ionicons name={icon} size={16} color={active ? colors.brand : colors.fgMuted} />
      <Text variant="label" tone={active ? 'brand' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

function NutrientRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="mono">{value}</Text>
    </View>
  );
}

/** One legend entry below the macro share bar: a colored dot, label and gram value. */
function MacroLegendItem({
  colorClassName,
  label,
  value,
}: {
  colorClassName: string;
  label: string;
  value: string;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1.5">
        <View className={cn('h-2 w-2 rounded-full', colorClassName)} />
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      </View>
      <Text variant="body">{value}</Text>
    </View>
  );
}
