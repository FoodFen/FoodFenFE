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
    <View className="w-full items-center gap-6">
      <Text variant="title" className="text-center text-3xl">
        How active are you?
      </Text>
      <View className="w-full">
        <ActivityLevelList value={value} onChange={onChange} />
      </View>
    </View>
  );
}
