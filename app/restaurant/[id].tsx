import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, RefreshControl, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { DishRow } from '@/components/dishes/DishRow';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { overKcal } from '@/features/dishes/mappers';
import {
  useConfirmAddDish,
  useDishes,
  useDishesAvailable,
  useRestaurant,
} from '@/features/dishes/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { todayKey } from '@/lib/date';
import { colorsFor } from '@/theme/colors';

export default function RestaurantScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { data: restaurant, error, refetch, isRefetching, fetchStatus } = useRestaurant(id);
  const available = useDishesAvailable();
  const add = useConfirmAddDish();
  const remainingKcal = useDishes(todayKey(), {}, 10).data?.remainingKcal ?? null;

  if (!available) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title={t('dishes', 'needsSignIn')}
          actionLabel={t('dishes', 'signIn')}
          onAction={() => router.push('/sign-in')}
        />
      </Screen>
    );
  }

  if (!restaurant && fetchStatus === 'paused') {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title={t('dishes', 'needsConnection')} />
      </Screen>
    );
  }

  if (!restaurant && !error) {
    return (
      <ScrollScreen>
        <Skeleton className="-mx-4 -mt-4 h-56" />
        <View className="gap-6">
          <View className="gap-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <View className="gap-1">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </View>
          </View>
          <Skeleton className="h-40 rounded-card" />
        </View>
      </ScrollScreen>
    );
  }

  if (!restaurant) {
    return (
      <Screen>
        <ErrorState
          description={
            isApiError(error) ? error.userMessage : t('dishes', 'restaurantLoadError')
          }
          onRetry={() => void refetch()}
        />
      </Screen>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;

  return (
    <ScrollScreen
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.fgMuted}
        />
      }
    >
      <Stack.Screen options={{ title: restaurant.name }} />

      {restaurant.imageUrl ? (
        <Image
          source={{ uri: restaurant.imageUrl }}
          className="-mx-4 -mt-4 h-56"
          contentFit="cover"
        />
      ) : (
        <View className="-mx-4 -mt-4 h-56 items-center justify-center bg-surface-alt">
          <Ionicons name="restaurant-outline" size={48} color={colors.fgSubtle} />
        </View>
      )}

      <View className="gap-6">
        <View className="gap-3">
          <View className="gap-1">
            <Text variant="title">{restaurant.name}</Text>
            {restaurant.description ? (
              <Text tone="muted" numberOfLines={3}>
                {restaurant.description}
              </Text>
            ) : null}
          </View>

          <View className="gap-1">
            <Pressable
              onPress={() => void Linking.openURL(mapsUrl)}
              accessibilityRole="link"
              accessibilityLabel={`${t('dishes', 'directions')}: ${restaurant.address}`}
              className="min-h-11 flex-row items-center gap-3"
            >
              <Ionicons name="location-outline" size={18} color={colors.fgMuted} />
              <Text variant="body" className="flex-1">
                {restaurant.address}
              </Text>
            </Pressable>
            {restaurant.phone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${restaurant.phone}`)}
                accessibilityRole="link"
                accessibilityLabel={`${t('dishes', 'call')}: ${restaurant.phone}`}
                className="min-h-11 flex-row items-center gap-3"
              >
                <Ionicons name="call-outline" size={18} color={colors.fgMuted} />
                <Text variant="body" className="flex-1">
                  {restaurant.phone}
                </Text>
              </Pressable>
            ) : (
              <View className="min-h-11 flex-row items-center gap-3">
                <Ionicons name="call-outline" size={18} color={colors.fgMuted} />
                <Text variant="body" tone="muted" className="flex-1">
                  {t('dishes', 'notAvailable')}
                </Text>
              </View>
            )}
            <View className="min-h-11 flex-row items-center gap-3">
              <Ionicons name="time-outline" size={18} color={colors.fgMuted} />
              <Text
                variant="body"
                tone={restaurant.openingHours ? undefined : 'muted'}
                className="flex-1"
              >
                {restaurant.openingHours ?? t('dishes', 'notAvailable')}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row gap-3">
          <Button
            label={t('dishes', 'directions')}
            className="flex-1"
            leading={<Ionicons name="navigate" size={18} color={colors.onBrand} />}
            onPress={() => void Linking.openURL(mapsUrl)}
          />
          {restaurant.phone ? (
            <Button
              label={t('dishes', 'call')}
              variant="secondary"
              className="flex-1"
              leading={<Ionicons name="call" size={18} color={colors.fg} />}
              onPress={() => void Linking.openURL(`tel:${restaurant.phone}`)}
            />
          ) : null}
        </View>

        <View className="gap-3">
          <View className="flex-row items-baseline justify-between">
            <Text variant="heading">{t('dishes', 'menu')}</Text>
            <Text variant="caption" tone="muted">
              {t('dishes', 'menuCount').replace('{n}', String(restaurant.dishes.length))}
            </Text>
          </View>
          <View className="gap-4">
            {restaurant.dishes.map((dish) => {
              const fits = remainingKcal !== null && dish.kcal <= remainingKcal;
              const listed = { ...dish, fits };

              return (
                <DishRow
                  key={dish.id}
                  dish={dish}
                  fits={fits}
                  overKcal={overKcal(listed, remainingKcal)}
                  onAdd={() => add.request(listed, remainingKcal)}
                  adding={add.isAdding(dish.id)}
                  added={add.isAdded(dish.id)}
                />
              );
            })}
          </View>
        </View>
      </View>
    </ScrollScreen>
  );
}
