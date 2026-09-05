import { View } from 'react-native';

import { ChipRow } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import type { Gender } from '@/types/models';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

export interface GenderStepProps {
  value: Gender;
  onChange: (value: Gender) => void;
}

export function GenderStep({ value, onChange }: GenderStepProps) {
  return (
    <View className="gap-4">
      <Text variant="title">What&apos;s your sex?</Text>
      <ChipRow options={GENDER_OPTIONS} value={value} onChange={onChange} />
    </View>
  );
}
