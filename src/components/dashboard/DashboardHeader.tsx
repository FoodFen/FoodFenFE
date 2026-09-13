import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useCoinBalance } from '@/features/dashboard/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

/**
 * The dashboard's top bar: the wordmark, the coin balance, and the shortcuts
 * to the shop and settings that the screenshot design puts here instead of in
 * the tab bar.
 */
export function DashboardHeader() {
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

      <View className="flex-row items-center gap-3">
        <View
          className="flex-row items-center gap-1"
          accessibilityRole="text"
          accessibilityLabel={t('dashboard', 'pointsA11y').replace('{count}', String(coins))}
        >
          <Ionicons name="sparkles" size={16} color={colors.warning} />
          <Text variant="label">{coins}</Text>
        </View>

        <Pressable
          onPress={() => router.push('/shop')}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard', 'openShop')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name="bag-handle-outline" size={22} color={colors.fgMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard', 'openSettings')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name="settings-outline" size={22} color={colors.fgMuted} />
        </Pressable>
      </View>
    </View>
  );
}
