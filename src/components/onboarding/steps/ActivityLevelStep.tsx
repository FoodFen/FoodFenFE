import { View } from 'react-native';

import { ActivityLevelList } from '@/components/profile/BodyStatsForm';
import { Text } from '@/components/ui/Text';
import type { ActivityLevel } from '@/types/models';

export interface ActivityLevelStepProps {
  value: ActivityLevel;
  onChange: (value: ActivityLevel) => void;
}

export function ActivityLevelStep({ value, onChange }: ActivityLevelStepProps) {
  return (
    <View className="gap-4">
      <Text variant="title">How active are you?</Text>
      <ActivityLevelList value={value} onChange={onChange} />
    </View>
  );
}
