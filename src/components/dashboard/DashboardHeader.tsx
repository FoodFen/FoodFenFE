import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useCoinBalance } from '@/features/dashboard/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/**
 * The dashboard's top bar: the wordmark, plus either the coin balance and the
 * shortcuts to the shop and settings, or — while browsing a day other than
 * today — a single shortcut back to it. Browsing history and needing the
 * shop or settings at the same time is rare enough that trading them away
 * temporarily is worth how fast "back to today" becomes.
 */
export function DashboardHeader({
  isToday,
  onBackToToday,
}: {
  isToday: boolean;
  onBackToToday: () => void;
}) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { t } = useTranslation();
  const { data: coins = 0 } = useCoinBalance();

  return (
    <View className="flex-row items-center justify-between px-4 pt-2">
      <View className="flex-row items-start">
        <Text variant="title">FoodFen</Text>
        <View
          className="ml-1 mt-1 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: colors.warning }}
        />
      </View>

      {isToday ? (
        <View className="flex-row items-center gap-1">
          <PressableScale
            onPress={() => router.push('/shop')}
            accessibilityRole="button"
            accessibilityLabel={`${t('dashboard', 'openShop')} — ${t(
              'dashboard',
              'pointsA11y',
            ).replace('{count}', String(coins))}`}
            className="mr-2 h-9 flex-row items-center gap-1 rounded-pill bg-warning/10 px-3"
          >
            <Ionicons name="sparkles" size={16} color={colors.warning} />
            <Text variant="label">{coins}</Text>
          </PressableScale>

          <PressableScale
            onPress={() => router.push('/chat')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard', 'openChat')}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.fgMuted} />
          </PressableScale>

          <PressableScale
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard', 'openSettings')}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="settings-outline" size={22} color={colors.fgMuted} />
          </PressableScale>
        </View>
      ) : (
        <PressableScale
          onPress={onBackToToday}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard', 'backToToday')}
          className="flex-row items-center gap-1.5 rounded-pill border border-border px-3 py-1.5"
        >
          <Ionicons name="calendar-clear-outline" size={16} color={colors.brand} />
          <Text variant="label" tone="brand">
            {t('dashboard', 'backToToday')}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}
