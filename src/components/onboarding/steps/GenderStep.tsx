import { View } from 'react-native';

import { OptionList } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import type { Gender } from '@/types/models';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: '♂️' },
  { value: 'female', label: 'Female', icon: '♀️' },
  { value: 'other', label: 'Prefer not to answer', icon: '🙂' },
];

export interface GenderStepProps {
  value: Gender;
  onChange: (value: Gender) => void;
}

export function GenderStep({ value, onChange }: GenderStepProps) {
  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          What&apos;s your sex?
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          This helps us personalize your daily calorie target.
        </Text>
      </View>
      <OptionList options={GENDER_OPTIONS} value={value} onChange={onChange} />
    </View>
  );
}
