import { View } from 'react-native';

import { WheelPicker } from '@/components/onboarding/WheelPicker';
import { Text } from '@/components/ui/Text';
import type { UnitSystem } from '@/types/models';

const CM_OPTIONS = Array.from({ length: 121 }, (_, i) => {
  const cm = i + 100; // 100–220 cm
  return { value: cm, label: `${cm} cm` };
});

const FEET_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const feet = i + 3; // 3–7 ft
  return { value: feet, label: `${feet} ft` };
});

const INCH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: `${i} in`,
}));

const CM_PER_INCH = 2.54;

/**
 * Private to this step: `units.weightFromKg`/`weightToKg` in the settings
 * store already cover kg↔lb, but nothing else needs a height conversion yet.
 */
function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);

  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

function ftInToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export interface HeightStepProps {
  unitSystem: UnitSystem;
  /** Always in cm, converted for display when the unit system is imperial. */
  value: number;
  onChange: (cm: number) => void;
}

export function HeightStep({ unitSystem, value, onChange }: HeightStepProps) {
  if (unitSystem === 'imperial') {
    const { feet, inches } = cmToFtIn(value);

    return (
      <View className="w-full items-center gap-6">
        <Text variant="title" className="w-full text-center text-3xl">
          How tall are you?
        </Text>
        <View className="w-full flex-row items-center justify-center gap-4">
          <WheelPicker
            data={FEET_OPTIONS}
            value={feet}
            onChange={(nextFeet) => onChange(ftInToCm(nextFeet, inches))}
          />
          <WheelPicker
            data={INCH_OPTIONS}
            value={inches}
            onChange={(nextInches) => onChange(ftInToCm(feet, nextInches))}
          />
        </View>
        <Text variant="heading" tone="brand">
          {feet}&apos; {inches}&quot;
        </Text>
      </View>
    );
  }

  const cm = Math.round(value);

  return (
    <View className="w-full items-center gap-6">
      <Text variant="title" className="w-full text-center text-3xl">
        How tall are you?
      </Text>
      <WheelPicker data={CM_OPTIONS} value={cm} onChange={onChange} sideLabel={`${cm.toFixed(1)} cm`} />
    </View>
  );
}
