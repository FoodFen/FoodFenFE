import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ImageProps } from 'expo-image';
import { cssInterop } from 'nativewind';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

/** Dish/restaurant photo that falls back to the placeholder when the URL is missing or fails to load. */

cssInterop(Image, { className: 'style' });
// cssInterop adds `className` at runtime; ImageProps does not declare it.
const StyledImage = Image as ComponentType<ImageProps & { className?: string }>;

export interface DishImageProps {
  uri: string | null | undefined;
  className: string;
  iconSize: number;
}

export function DishImage({ uri, className, iconSize }: DishImageProps) {
  const { resolved } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);

  if (uri && uri !== failedUri) {
    return (
      <StyledImage
        source={{ uri }}
        className={className}
        contentFit="cover"
        onError={() => setFailedUri(uri)}
      />
    );
  }

  return (
    <View className={`${className} items-center justify-center bg-surface-alt`}>
      <Ionicons name="restaurant-outline" size={iconSize} color={colorsFor(resolved).fgSubtle} />
    </View>
  );
}
