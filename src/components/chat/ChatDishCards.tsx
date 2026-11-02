import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { RemoteChatDish } from '@/api/schemas';
import { DishImage } from '@/components/dishes/DishImage';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { formatVnd } from '@/features/dishes/mappers';

/** Dish suggestions under an assistant bubble: at most five compact cards that open the restaurant. */

const MAX_CARDS = 5;

export function ChatDishCards({ dishes }: { dishes: RemoteChatDish[] }) {
  return (
    <View className="mt-2 w-[85%] gap-2 self-start">
      {dishes.slice(0, MAX_CARDS).map((dish) => (
        <Pressable
          key={dish.id}
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/restaurant/[id]', params: { id: dish.restaurant.id } })
          }
        >
          <Card flush className="flex-row items-center gap-3 overflow-hidden p-2">
            <DishImage uri={dish.imageUrl} className="h-14 w-14 rounded-card" iconSize={24} />
            <View className="flex-1 gap-0.5">
              <Text variant="label" numberOfLines={1}>
                {dish.name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {dish.restaurant.name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {`${Math.round(dish.kcal).toLocaleString()} kcal · ${formatVnd(dish.price)}`}
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
