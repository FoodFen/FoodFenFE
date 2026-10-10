import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { RemoteDish } from '@/api/schemas';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { formatVnd } from '@/features/dishes/mappers';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

export interface DishRowProps {
  dish: RemoteDish;
  /** The restaurant's name, shown on the list but not on the restaurant's own page. */
  restaurantName?: string;
  fits?: boolean;
  onPress?: () => void;
  onAdd: () => void;
  adding?: boolean;
  added?: boolean;
  /** Whole kcal this dish exceeds today's remaining budget by; shown when `fits` is false. */
  overKcal?: number;
}

export function DishRow({
  dish,
  restaurantName,
  fits,
  onPress,
  onAdd,
  adding,
  added,
  overKcal,
}: DishRowProps) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  // Whole grams for display only; stored values are untouched.
  const macros = [
    { grams: Math.round(dish.proteinG), label: t('dashboard', 'protein'), tone: 'text-protein' },
    { grams: Math.round(dish.carbsG), label: t('dashboard', 'carbs'), tone: 'text-carbs' },
    { grams: Math.round(dish.fatG), label: t('dashboard', 'fat'), tone: 'text-fat' },
  ];

  return (
    <Card flush className="overflow-hidden">
      <Pressable onPress={onPress} disabled={!onPress}>
        {dish.imageUrl ? (
          <Image
            source={{ uri: dish.imageUrl }}
            className="h-40 w-full"
            contentFit="cover"
          />
        ) : (
          <View className="h-40 w-full items-center justify-center bg-surface-alt">
            <Ionicons name="restaurant-outline" size={48} color={colors.fgSubtle} />
          </View>
        )}

        {fits ? (
          <View className="absolute left-0 top-0 m-3 flex-row items-center gap-1 rounded-pill bg-brand px-2.5 py-1">
            <Ionicons name="checkmark" size={14} color={colors.onBrand} />
            <Text variant="caption" tone="onBrand" className="font-medium">
              {t('dishes', 'fits')}
            </Text>
          </View>
        ) : overKcal !== undefined ? (
          <View className="absolute left-0 top-0 m-3 flex-row items-center gap-1 rounded-pill bg-warning px-2.5 py-1">
            <Ionicons name="alert-circle" size={14} color={colors.onBrand} />
            <Text variant="caption" tone="onBrand" className="font-medium">
              {t('dishes', 'overBy').replace('{kcal}', String(overKcal))}
            </Text>
          </View>
        ) : null}

        <View className="gap-2 p-4">
          <Text variant="label" numberOfLines={2}>
            {dish.name}
          </Text>

          {restaurantName ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="storefront-outline" size={14} color={colors.fgMuted} />
              <Text variant="caption" tone="muted" className="flex-1" numberOfLines={1}>
                {restaurantName}
              </Text>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-2">
            {macros.map((m) => (
              <View key={m.label} className="rounded-pill bg-surface-alt px-2.5 py-1">
                <Text variant="caption" tone="muted">
                  <Text variant="caption" className={`font-medium ${m.tone}`}>
                    {`${m.grams} g `}
                  </Text>
                  {m.label}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-1 flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-baseline gap-1">
                {/* Whole kcal for display only; the stored value is untouched. */}
                <Text variant="title">{Math.round(dish.kcal).toLocaleString()}</Text>
                <Text variant="caption" tone="muted">
                  kcal
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                {formatVnd(dish.price)}
              </Text>
            </View>

            <Pressable
              onPress={onAdd}
              disabled={adding}
              accessibilityRole="button"
              accessibilityLabel={t('dishes', 'addToDiary')}
              className="h-11 w-11 items-center justify-center rounded-full bg-brand active:opacity-80"
            >
              {adding ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Ionicons name={added ? 'checkmark' : 'add'} size={24} color={colors.onBrand} />
              )}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Card>
  );
}
