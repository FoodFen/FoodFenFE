/**
 * Manual activity logging (UC-16): a static preset table and the calorie
 * formula it uses, mirroring nutrition.ts's role for food.
 */

/**
 * Also the key under the i18n `activityPresets` namespace — one id serves
 * both jobs, since the preset's own name is its label.
 */
export type ActivityPresetId =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'elliptical'
  | 'swimming'
  | 'strength';

export interface ActivityPreset {
  /** Stable slug, stored as `activity_log.activity_type`. */
  id: ActivityPresetId;
  /** An `Ionicons` glyph name — kept as `string` so this file stays UI-free. */
  icon: string;
  kcalPer30Min: number;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  // Walking/Running/Cycling rates are the ones named in the UC-16 spec.
  { id: 'walking', icon: 'walk-outline', kcalPer30Min: 141 },
  { id: 'running', icon: 'walk', kcalPer30Min: 351 },
  { id: 'cycling', icon: 'bicycle-outline', kcalPer30Min: 324 },
  // TODO(UC-16): placeholders, not from the spec's source table — confirm
  // Elliptical, Swimming and Strength against the real recording/table before
  // shipping; these three are reasonable guesses, not sourced figures.
  { id: 'elliptical', icon: 'fitness-outline', kcalPer30Min: 335 },
  { id: 'swimming', icon: 'water-outline', kcalPer30Min: 298 },
  { id: 'strength', icon: 'barbell-outline', kcalPer30Min: 224 },
];

export function getActivityPreset(id: string): ActivityPreset | undefined {
  return ACTIVITY_PRESETS.find((preset) => preset.id === id);
}

/** calories_burned = rate × (duration / 30), rounded to the nearest kcal. */
export function caloriesBurnedForPreset(
  preset: ActivityPreset,
  durationMinutes: number,
): number {
  return Math.round(preset.kcalPer30Min * (durationMinutes / 30));
}
