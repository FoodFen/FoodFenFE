import { useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { DishRow } from '@/components/dishes/DishRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Screen, ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useAddDishToDiary, useRestaurant } from '@/features/dishes/queries';
import { useTranslation } from '@/hooks/useTranslation';

export default function RestaurantScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: restaurant, error, refetch } = useRestaurant(id);
  const add = useAddDishToDiary();

  if (!restaurant && !error) {
    return (
      <ScrollScreen>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-card" />
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
    <ScrollScreen>
      <Card className="gap-2">
        <Text variant="title">{restaurant.name}</Text>
        {restaurant.description ? (
          <Text tone="muted">{restaurant.description}</Text>
        ) : null}
        <Text variant="body">{restaurant.address}</Text>
        {restaurant.phone ? (
          <Text variant="body">{`${t('dishes', 'phone')}: ${restaurant.phone}`}</Text>
        ) : null}
        {restaurant.openingHours ? (
          <Text variant="body">{`${t('dishes', 'openingHours')}: ${restaurant.openingHours}`}</Text>
        ) : null}
        <Button
          label={t('dishes', 'openInMaps')}
          variant="secondary"
          onPress={() => void Linking.openURL(mapsUrl)}
        />
      </Card>

      <Text variant="heading">{t('dishes', 'menu')}</Text>
      <View className="gap-3">
        {restaurant.dishes.map((dish) => (
          <DishRow
            key={dish.id}
            dish={dish}
            onAdd={() => add.mutate(dish)}
            adding={add.isPending && add.variables?.id === dish.id}
          />
        ))}
      </View>
    </ScrollScreen>
  );
}
