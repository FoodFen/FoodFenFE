import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

/** A soft Sprout Wash blob (a disc plus a smaller satellite) to sit behind a mascot or vignette. */
export function SproutWash({ size }: { size: number }) {
  const { resolved } = useAppTheme();
  const { brandSoft } = colorsFor(resolved);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" pointerEvents="none">
      <Circle cx={50} cy={50} r={50} fill={brandSoft} />
      <Circle cx={86} cy={16} r={10} fill={brandSoft} opacity={0.6} />
    </Svg>
  );
}
