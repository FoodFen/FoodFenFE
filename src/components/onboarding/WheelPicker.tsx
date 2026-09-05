import QuidoneWheelPicker from '@quidone/react-native-wheel-picker';

import { useAppTheme } from '@/hooks/useAppTheme';
import { colorsFor } from '@/theme/colors';

export interface WheelPickerItem<T extends string | number> {
  value: T;
  label: string;
}

export interface WheelPickerProps<T extends string | number> {
  data: WheelPickerItem<T>[];
  value: T;
  onChange: (value: T) => void;
  itemHeight?: number;
  visibleItemCount?: number;
  width?: number | 'auto' | `${number}%`;
}

/** The onboarding wizard's scroll-wheel input, themed to match the app palette. */
export function WheelPicker<T extends string | number>({
  data,
  value,
  onChange,
  itemHeight = 44,
  visibleItemCount = 5,
  width,
}: WheelPickerProps<T>) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  return (
    <QuidoneWheelPicker
      data={data}
      value={value}
      onValueChanged={({ item }) => onChange(item.value)}
      itemHeight={itemHeight}
      visibleItemCount={visibleItemCount}
      width={width}
      enableScrollByTapOnItem
      itemTextStyle={{ color: colors.fg, fontSize: 18 }}
      overlayItemStyle={{ backgroundColor: colors.surfaceAlt, borderRadius: 12 }}
    />
  );
}
