import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from 'react-native';

import { PaceSlider } from '@/components/onboarding/PaceSlider';
import { Text } from '@/components/ui/Text';
import { units } from '@/features/settings/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { goalDirection, maxWeeklyRateKg } from '@/lib/nutrition';
import { colorsFor } from '@/theme/colors';
import type { ActivityLevel, Gender, UnitSystem } from '@/types/models';

/**
 * The slowest pace on offer, defined in pounds/week and converted to kg once
 * here — `weeklyRateKg`, what's stored and passed in `value`/`onChange`, is
 * always kg regardless of `unitSystem`. The fastest is per-user (20% of TDEE).
 */
const MIN_RATE_LB = 0.2;

export const MIN_RATE_KG = units.weightToKg(MIN_RATE_LB, 'lb');

type Zone = 'tooSlow' | 'safe' | 'reasonable' | 'tooFast';

/** Quartiles of the range: the middle half is the recommended pace. */
function zoneFor(fraction: number): Zone {
  if (fraction < 0.25) return 'tooSlow';
  if (fraction < 0.5) return 'safe';
  if (fraction < 0.75) return 'reasonable';
  return 'tooFast';
}

const ZONE_TONE: Record<Zone, 'success' | 'warning'> = {
  tooSlow: 'warning',
  safe: 'success',
  reasonable: 'success',
  tooFast: 'warning',
};

const ZONE_MESSAGE_KEY = {
  tooSlow: 'tooSlowMessage',
  safe: 'safeMessage',
  reasonable: 'reasonableMessage',
  tooFast: 'tooFastMessage',
} as const;

export interface RateStepProps {
  unitSystem: UnitSystem;
  value: number;
  onChange: (value: number) => void;
  /** Always in kg. Direction (lose/gain) is derived from comparing the two — never collected as a separate choice, so it can't disagree with the target weight. */
  weightCurrent: number;
  weightGoal: number;
  gender: Gender;
  birthYear: number;
  height: number;
  activityLevel: ActivityLevel;
}

/** Shown only when the target-weight step's goal isn't (effectively) maintain. */
export function RateStep({
  unitSystem,
  value,
  onChange,
  weightCurrent,
  weightGoal,
  gender,
  birthYear,
  height,
  activityLevel,
}: RateStepProps) {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const unit = unitSystem === 'imperial' ? 'lb' : 'kg';
  const isGain = goalDirection({ weightCurrent, weightGoal }) === 'gain';

  const maxRateKg = maxWeeklyRateKg({ gender, birthYear, height, weightCurrent, activityLevel });

  const fraction = (value - MIN_RATE_KG) / (maxRateKg - MIN_RATE_KG);
  const zone = zoneFor(Math.min(1, Math.max(0, fraction)));

  const displayRate = units.weightFromKg(value, unit).toFixed(1);
  const deltaDisplay = units.weightFromKg(Math.abs(weightGoal - weightCurrent), unit).toFixed(1);

  const subtitle = t('onboardingRate', isGain ? 'subtitleGain' : 'subtitleLose')
    .replace('{amount}', deltaDisplay)
    .replace('{unit}', unit);
  const paceLabel = t('onboardingRate', 'paceLabel')
    .replace('{amount}', displayRate)
    .replace('{unit}', unit);
  const zoneLabelKey = `${zone === 'tooSlow' ? 'slow' : zone === 'tooFast' ? 'fast' : 'moderate'}${
    isGain ? 'Gain' : 'Loss'
  }` as 'slowLoss' | 'slowGain' | 'moderateLoss' | 'moderateGain' | 'fastLoss' | 'fastGain';

  return (
    <View className="w-full items-center gap-6">
      <View className="w-full items-center gap-2">
        <Text variant="title" className="w-full text-center text-3xl">
          {t('onboardingRate', isGain ? 'titleGain' : 'titleLose')}
        </Text>
        <Text variant="body" tone="muted" className="text-center">
          {subtitle}
        </Text>
      </View>

      <View className="items-center gap-1">
        <Ionicons
          name={isGain ? 'trending-up' : 'trending-down'}
          size={32}
          color={colors.brand}
        />
        <Text variant="title" className="text-3xl">
          {paceLabel}
        </Text>
        <Text variant="body" tone="muted">
          {t('onboardingRate', zoneLabelKey)}
        </Text>
      </View>

      <PaceSlider
        min={MIN_RATE_KG}
        max={maxRateKg}
        value={value}
        onChange={onChange}
        leftIcon={<MaterialCommunityIcons name="tortoise" size={28} color={colors.fgMuted} />}
        rightIcon={<MaterialCommunityIcons name="rabbit" size={28} color={colors.fgMuted} />}
        tone={ZONE_TONE[zone]}
      />

      <View className="w-full rounded-card bg-surface-alt px-4 py-3">
        <Text tone={ZONE_TONE[zone]} className="text-center">
          {t('onboardingRate', ZONE_MESSAGE_KEY[zone])}
        </Text>
      </View>
    </View>
  );
}
