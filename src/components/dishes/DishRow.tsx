import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import type { RemoteDish } from '@/api/schemas';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { formatVnd } from '@/features/dishes/mappers';
import { useTranslation } from '@/hooks/useTranslation';

export interface DishRowProps {
  dish: RemoteDish;
  /** The restaurant's name, shown on the list but not on the restaurant's own page. */
  restaurantName?: string;
  fits?: boolean;
  onPress?: () => void;
  onAdd: () => void;
  adding?: boolean;
}

export function DishRow({
  dish,
  restaurantName,
  fits,
  onPress,
  onAdd,
  adding,
}: DishRowProps) {
  const { t } = useTranslation();

  return (
    <Card className="gap-3">
      <Pressable onPress={onPress} disabled={!onPress} className="flex-row gap-3">
        {dish.imageUrl ? (
          <Image
            source={{ uri: dish.imageUrl }}
            className="h-16 w-16 rounded-card"
            contentFit="cover"
          />
        ) : null}

        <View className="flex-1 gap-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text variant="label" className="flex-1">
              {dish.name}
            </Text>
            {fits ? (
              <Text variant="caption" tone="success">
                {t('dishes', 'fits')}
              </Text>
            ) : null}
          </View>

          {restaurantName ? (
            <Text variant="caption" tone="muted">
              {restaurantName}
            </Text>
          ) : null}

          <Text variant="caption" tone="muted">
            {`${dish.kcal.toLocaleString()} kcal · ${formatVnd(dish.price)}`}
          </Text>
          <Text variant="caption" tone="subtle">
            {t('dishes', 'macros')
              .replace('{p}', String(dish.proteinG))
              .replace('{c}', String(dish.carbsG))
              .replace('{f}', String(dish.fatG))}
          </Text>
        </View>
      </Pressable>

      <Button
        label={t('dishes', 'addToDiary')}
        size="sm"
        variant="secondary"
        loading={adding}
        onPress={onAdd}
      />
    </Card>
  );
}
