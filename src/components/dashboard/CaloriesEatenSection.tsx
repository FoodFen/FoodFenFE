import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { foodEmojiFor } from '@/features/diary/foodEmoji';
import { useLogSheetStore } from '@/features/logging/store';
import { useProfileStore } from '@/features/profile/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
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
    (state) => state.profile?.calorieLeftMode ?? 'all_calories',
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
        <View className="flex-row items-center gap-2 py-1">
          <Text variant="body" tone="subtle" className="italic">
            {t('dashboard', 'logFirstMeal')}
          </Text>
          <Ionicons name="return-up-forward" size={20} color={colors.fgSubtle} />
        </View>
      ) : (
        <Pressable
          onPress={() => {
            haptics.selection();
            onOpenEntries?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard', 'viewEntriesA11y')}
          className="mt-1 flex-row items-center gap-2 py-1 active:opacity-60"
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
        </Pressable>
      )}
    </MetricSection>
  );
}
