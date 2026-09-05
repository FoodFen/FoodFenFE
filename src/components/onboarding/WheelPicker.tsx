import QuidoneWheelPicker from '@quidone/react-native-wheel-picker';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
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
  /** A bold "132.3 kg"-style readout shown beside the wheel. */
  sideLabel?: string;
}

/** The onboarding wizard's scroll-wheel input, themed to match the app palette. */
export function WheelPicker<T extends string | number>({
  data,
  value,
  onChange,
  itemHeight = 56,
  visibleItemCount = 5,
  width,
  sideLabel,
}: WheelPickerProps<T>) {
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);

  const picker = (
    <QuidoneWheelPicker
      data={data}
      value={value}
      onValueChanged={({ item }) => onChange(item.value)}
      itemHeight={itemHeight}
      visibleItemCount={visibleItemCount}
      width={width}
      enableScrollByTapOnItem
      itemTextStyle={{ color: colors.fg, fontSize: 26, fontWeight: '700' }}
      overlayItemStyle={{ borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.brand }}
    />
  );

  if (!sideLabel) return picker;

  return (
    <View className="w-full flex-row items-center justify-center gap-3">
      {picker}
      <Text variant="heading" tone="brand" className="text-xl">
        {sideLabel}
      </Text>
    </View>
  );
}
