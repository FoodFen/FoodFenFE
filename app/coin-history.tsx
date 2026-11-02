import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { coinReasonLabelKey } from '@/features/gamification/coinHistory';
import { useCoinTransactions } from '@/features/gamification/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { formatLongDate, formatTime, toDateKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

export default function CoinHistoryScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [refreshing, setRefreshing] = useState(false);
  const {
    data,
    isPending,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCoinTransactions();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (!data && isPending) {
    return (
      <Screen edgeToEdgeBottom>
        <View className="gap-3 px-4 pt-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[64px]" />
          ))}
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen edgeToEdgeBottom>
        <ErrorState
          description={
            isApiError(error) ? error.userMessage : t('coinHistory', 'loadError')
          }
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen edgeToEdgeBottom>
      <FlatList
        data={data}
        keyExtractor={(row) => row.id}
        contentContainerClassName="gap-3 px-4 pb-4 pt-3"
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.fgMuted}
          />
        }
        ListEmptyComponent={
          <EmptyState icon="wallet-outline" title={t('coinHistory', 'empty')} />
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={colors.fgMuted} /> : null
        }
        renderItem={({ item }) => {
          const credit = item.amount > 0;

          return (
            <View className="h-[64px] flex-row items-center gap-3 rounded-card bg-surface px-4">
              <Ionicons
                name={credit ? 'add-circle' : 'remove-circle'}
                size={24}
                color={credit ? colors.success : colors.danger}
              />
              <View className="flex-1">
                <Text variant="label">
                  {t('coinHistory', coinReasonLabelKey(item.reason))}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatLongDate(toDateKey(new Date(item.createdAt)))}{' '}
                  {formatTime(item.createdAt)}
                </Text>
              </View>
              <Text variant="label" tone={credit ? 'success' : 'danger'}>
                {credit ? '+' : '−'}
                {Math.abs(item.amount).toLocaleString()}
              </Text>
            </View>
          );
        }}
      />
    </Screen>
  );
}
