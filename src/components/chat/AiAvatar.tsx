import { View } from 'react-native';

import { Mascot } from '@/components/mascot/Mascot';
import { useEquippedMascotId, useMascotBodyColor, useMascotImages } from '@/features/mascot/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { MascotAction } from '@/lib/mascot';
import { colorsFor } from '@/theme/colors';

/**
 * The assistant's avatar: the equipped mascot showing `action`. `glow` adds the
 * larger, softer halo used on the empty state hero.
 */

export interface AiAvatarProps {
  size?: number;
  action?: MascotAction;
  glow?: boolean;
}

export function AiAvatar({ size = 28, action = 'idle', glow = false }: AiAvatarProps) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const mascotId = useEquippedMascotId();
  const images = useMascotImages(mascotId);
  const bodyColor = useMascotBodyColor(mascotId);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      {glow ? (
        <View
          pointerEvents="none"
          className="absolute bg-brand/15"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            shadowColor: colors.brand,
            shadowOpacity: 0.45,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        />
      ) : null}
      <Mascot mascotId={mascotId} images={images} bodyColor={bodyColor} action={action} size={size} />
    </View>
  );
}
