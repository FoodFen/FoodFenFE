import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { foodEmojiFor } from '@/features/diary/foodEmoji';
import { useLogSheetStore } from '@/features/logging/store';
import { useProfileStore } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { kcalRemaining } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { DiaryDay } from '@/types/models';

import { MetricSection } from './MetricSection';

const PEEK_LIMIT = 6;

/** Calories logged today, the calories still available, and a peek at the meals. */
export function CaloriesEatenSection({
  day,
  onOpenEntries,
}: {
  day: DiaryDay;
  onOpenEntries?: () => void;
}) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const present = useLogSheetStore((state) => state.present);
  const calorieLeftMode = useProfileStore(
    (state) => state.profile?.calorieLeftMode ?? 'smart',
  );

  // Calories left today: target minus what was eaten, with eligible exercise
  // added back unless the user is on Smart mode (Settings → Smart mode).
  // "Eligible" already excludes ambient movement (steps) — see
  // DiaryDay.addBackEligibleExerciseKcal. Negative means over.
  const remaining = kcalRemaining(
    day.goal.targetKcal,
    day.totals.kcal,
    day.addBackEligibleExerciseKcal,
    calorieLeftMode,
  );
  const isOver = remaining < 0;
  const remainingLabel = (
    isOver ? t('dashboard', 'kcalOver') : t('dashboard', 'kcalLeft')
  ).replace('{kcal}', Math.abs(remaining).toLocaleString());

  // Newest first, so the last thing logged leads the peek.
  const peek = [...day.entries].reverse();
  const overflow = peek.length - PEEK_LIMIT;

  return (
    <MetricSection
      title={t('dashboard', 'caloriesEaten')}
      value={day.totals.kcal}
      onAdd={() => present('food')}
    >
      <Text variant="caption" tone={isOver ? 'danger' : 'muted'}>
        {remainingLabel}
      </Text>

      {day.entries.length === 0 ? (
        <PressableScale
          onPress={() => present('food')}
          accessibilityRole="button"
          className="h-10 flex-row items-center gap-2 self-start rounded-pill bg-brand/10 px-4"
        >
          <Ionicons name="add-circle" size={20} color={colors.brand} />
          <Text variant="label" tone="brand">
            {t('dashboard', 'logFirstMeal')}
          </Text>
        </PressableScale>
      ) : (
        <PressableScale
          onPress={onOpenEntries}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard', 'viewEntriesA11y')}
          className="mt-1 flex-row items-center gap-2 py-1"
        >
          <View className="flex-1 flex-row items-center gap-1">
            {peek.slice(0, PEEK_LIMIT).map((entry) => (
              <Text key={entry.id} className="text-lg">
                {foodEmojiFor(entry)}
              </Text>
            ))}
            {overflow > 0 ? (
              <Text variant="caption" tone="muted">
                {t('dashboard', 'moreEntries').replace('{count}', String(overflow))}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.fgSubtle} />
        </PressableScale>
      )}
    </MetricSection>
  );
}
