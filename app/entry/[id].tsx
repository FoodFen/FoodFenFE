import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useDeleteEntry, useEntry, useUpdateEntry } from '@/features/diary/queries';
import { MEAL_LABELS } from '@/features/diary/selectors';
import { useIsPremium } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
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
          error instanceof Error ? error.message : 'That meal could not be loaded.'
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const share = macroEnergyShare(entry);

  const setFeedback = (feedback: AiFeedback) => {
    haptics.selection();
    // Tapping the active thumb clears it, so a mis-tap is undoable.
    updateEntry.mutate({
      id: entry.id,
      patch: { aiFeedback: entry.aiFeedback === feedback ? null : feedback },
    });
  };

  const confirmDelete = () => {
    Alert.alert(entry.name, 'Remove this meal from your diary?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
        <View className="gap-1">
          <Text variant="title">{entry.name}</Text>
          <Text variant="body" tone="muted">
            {MEAL_LABELS[entry.mealType]} · {formatDiaryDate(entry.loggedOn)} at{' '}
            {formatTime(entry.loggedAt.toISOString())}
          </Text>
        </View>

        <Card className="gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text variant="heading">Total</Text>
            <Text variant="title">{entry.totalKcal.toLocaleString()} kcal</Text>
          </View>

          <View className="gap-2 border-t border-border pt-3">
            <NutrientRow
              label="Protein"
              value={`${entry.proteinG} g`}
              percent={share.proteinG}
            />
            <NutrientRow
              label="Carbs"
              value={`${entry.carbsG} g`}
              percent={share.carbsG}
            />
            <NutrientRow label="Fat" value={`${entry.fatG} g`} percent={share.fatG} />

            {entry.fiberG !== null ? (
              isPremium ? (
                <NutrientRow label="Fiber" value={`${entry.fiberG} g`} />
              ) : (
                <View className="flex-row items-center justify-between">
                  <Text variant="body" tone="muted">
                    Fiber
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="lock-closed" size={12} color={colors.fgSubtle} />
                    <Text variant="caption" tone="subtle">
                      Premium
                    </Text>
                  </View>
                </View>
              )
            ) : null}
          </View>
        </Card>

        <Card flush className="overflow-hidden">
          <View className="px-4 pb-2 pt-4">
            <Text variant="heading">Ingredients</Text>
          </View>

          {entry.ingredients.length === 0 ? (
            <View className="px-4 pb-4">
              <Text variant="body" tone="subtle">
                This meal was logged without a breakdown.
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
            <Text variant="heading">Was this right?</Text>
            <Text variant="body" tone="muted">
              Your answer helps improve how meals are read.
            </Text>

            <View className="flex-row gap-2">
              <FeedbackButton
                icon="thumbs-up"
                label="Looks right"
                active={entry.aiFeedback === 'up'}
                onPress={() => setFeedback('up')}
              />
              <FeedbackButton
                icon="thumbs-down"
                label="Not quite"
                active={entry.aiFeedback === 'down'}
                onPress={() => setFeedback('down')}
              />
            </View>
          </Card>
        ) : null}

        <Button
          label="Delete meal"
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
        'h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border',
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

function NutrientRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  /** Share of total energy, 0–1. Shown only for the three macros. */
  percent?: number;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="body" tone="muted">
        {label}
      </Text>

      <View className="flex-row items-baseline gap-2">
        {percent !== undefined ? (
          <Text variant="caption" tone="subtle">
            {Math.round(percent * 100)}%
          </Text>
        ) : null}
        <Text variant="mono">{value}</Text>
      </View>
    </View>
  );
}
