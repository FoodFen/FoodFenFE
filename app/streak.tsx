import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { Share, View } from 'react-native';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useStreak } from '@/features/gamification/queries';
import { streakDayStatuses } from '@/features/gamification/selectors';
import { useSettingsStore } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatWeekdayInitial, todayKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/**
 * The day-streak detail screen (UC-24b's "real app" extra): the current run,
 * a 7-day row, a share action, and a once-a-day commitment tap.
 *
 * Reached from the achievements screen's streak summary card. Streak state
 * lives in `STREAK` already — this screen only reads and displays it; nothing
 * here can move the streak itself, that only ever happens by logging.
 */
export default function StreakScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { data: streak, isPending, error, refetch } = useStreak();
  const streakCommittedDate = useSettingsStore((state) => state.streakCommittedDate);
  const commitToStreak = useSettingsStore((state) => state.commitToStreak);

  const committedToday = streakCommittedDate === todayKey();

  if (isPending) {
    return (
      <ScrollScreen bottomSpacing={48}>
        <Stack.Screen options={{ title: t('streak', 'title') }} />
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </ScrollScreen>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ title: t('streak', 'title') }} />
        <ErrorState
          description={
            error instanceof Error ? error.message : t('common', 'pleaseTryAgain')
          }
          onRetry={() => void refetch()}
        />
      </View>
    );
  }

  const currentStreak = streak?.currentStreak ?? 0;
  const days = streakDayStatuses(streak ?? undefined);

  const share = () => {
    haptics.selection();
    void Share.share({
      message: t('streak', 'shareMessage').replace('{days}', String(currentStreak)),
    });
  };

  const commit = () => {
    haptics.success();
    commitToStreak(todayKey());
  };

  return (
    <ScrollScreen bottomSpacing={48}>
      <Stack.Screen options={{ title: t('streak', 'title') }} />

      <Card className="items-center gap-2 py-6">
        <Ionicons name="flame" size={40} color={colors.warning} />
        <View className="flex-row items-baseline gap-1.5">
          <AnimatedNumber value={currentStreak} variant="display" />
          <Text variant="body" tone="muted">
            {t('streak', 'days')}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          {t('streak', 'currentStreak')}
        </Text>

        {currentStreak === 0 ? (
          <Text variant="caption" tone="subtle" className="pt-2 text-center">
            {t('streak', 'noStreakYet')}
          </Text>
        ) : null}
      </Card>

      <Card className="gap-3">
        <View className="flex-row justify-between">
          {days.map((day) => (
            <View key={day.date} className="items-center gap-1.5">
              <Text variant="caption" tone="subtle">
                {formatWeekdayInitial(day.date)}
              </Text>
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: day.active ? colors.warning : colors.surfaceAlt,
                }}
              >
                {day.active ? (
                  <Ionicons name="flame" size={18} color={colors.onBrand} />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card className="flex-row items-center justify-between">
        <Text variant="label" tone="muted">
          {t('streak', 'longestStreak')}
        </Text>
        <Text variant="heading">
          {(streak?.longestStreak ?? 0).toLocaleString()} {t('streak', 'days')}
        </Text>
      </Card>

      <View className="gap-2">
        <Button
          label={committedToday ? t('streak', 'committedToday') : t('streak', 'commit')}
          onPress={commit}
          disabled={committedToday}
          fullWidth
          size="lg"
        />
        <Button
          label={t('streak', 'share')}
          onPress={share}
          variant="secondary"
          leading={<Ionicons name="share-social-outline" size={18} color={colors.fg} />}
          fullWidth
        />
      </View>
    </ScrollScreen>
  );
}
