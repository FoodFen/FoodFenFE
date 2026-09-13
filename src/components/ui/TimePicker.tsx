import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { WheelPicker } from '@/components/ui/WheelPicker';

/**
 * An hour/minute wheel pair for backdating a logged time, e.g. an activity's
 * `logged_at`. Minutes are 5-minute steps — plenty of precision for "when did
 * you work out", and a fifth of the rows to scroll through.
 */

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: String(hour).padStart(2, '0'),
}));

const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const minute = i * 5;
  return { value: minute, label: String(minute).padStart(2, '0') };
});

export interface TimeOfDay {
  hours: number;
  minutes: number;
}

export interface TimePickerProps {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  return (
    <View className="w-full flex-row items-center justify-center gap-2">
      <WheelPicker
        data={HOUR_OPTIONS}
        value={value.hours}
        onChange={(hours) => onChange({ hours, minutes: value.minutes })}
        width={72}
      />
      <Text variant="heading" tone="brand">
        :
      </Text>
      <WheelPicker
        data={MINUTE_OPTIONS}
        value={value.minutes}
        onChange={(minutes) => onChange({ hours: value.hours, minutes })}
        width={72}
      />
    </View>
  );
}
