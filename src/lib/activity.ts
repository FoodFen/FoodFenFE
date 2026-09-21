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

// Walking/Running/Cycling are the ones named directly in the UC-16 spec
// (Walking 141 kcal/30min, Running 351, Cycling 324) with no source cited.
// Elliptical/Swimming/Strength are not in the spec ("Elliptical, …" trails
// off with no figures) — sourced instead from the 2011 Compendium of
// Physical Activities (Ainsworth BE, et al. "2011 Compendium of Physical
// Activities: A Second Update of Codes and MET Values." Med Sci Sports
// Exerc. 2011;43(8):1575–1581), the standard peer-reviewed MET reference,
// via kcal/30min = MET × 3.5 × weightKg / 200 × 30 = MET × weightKg × 0.525.
//
// Reference weight: 70 kg. Not a Vietnamese-population figure — Vietnam's
// 2019–2020 National Nutrition Survey (Bộ Y tế) puts the average Vietnamese
// adult at 59.2±8.9 kg (male) / 50.8±6.6 kg (female), noticeably lighter.
// 70 kg was chosen instead to match the spec's own three figures: dividing
// each back out (kcal / weight / 0.525) lands within a few tenths of a real
// Compendium code at 70 kg (walking ≈3.8 MET, close to code 17190 "walking
// 2.8–3.2 mph" = 3.5; running ≈9.55, close to code 12050 "running 6 mph" =
// 9.8; cycling ≈8.8, close to code 01030 "bicycling 12–13.9 mph" = 8.0) —
// not proof of what the spec actually used, but the best-supported guess,
// and it keeps all six presets on one consistent reference person rather
// than mixing weight classes across rows of the same table.
//
// A more accurate (and more Vietnam-appropriate) design would scale every
// preset by the user's own profile weight — already collected at onboarding
// — instead of one flat reference figure for everyone. That's a bigger
// change than filling in three missing numbers, and it would also mean
// redefining the spec's three confirmed figures, so it's left as a future
// improvement rather than done here.
export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { id: 'walking', icon: 'walk-outline', kcalPer30Min: 141 },
  { id: 'running', icon: 'walk', kcalPer30Min: 351 },
  { id: 'cycling', icon: 'bicycle-outline', kcalPer30Min: 324 },
  // Code 02048 "Elliptical trainer, moderate effort" = 5.0 MET.
  { id: 'elliptical', icon: 'fitness-outline', kcalPer30Min: 184 },
  // Code 18310 "swimming, leisurely, not lap swimming, general" = 6.0 MET.
  { id: 'swimming', icon: 'water-outline', kcalPer30Min: 221 },
  // Code 02050 "resistance training (weight lifting), power lifting or body
  // building, vigorous effort" = 6.0 MET — same MET as swimming above, so
  // the same kcal figure; not a copy/paste mistake.
  { id: 'strength', icon: 'barbell-outline', kcalPer30Min: 221 },
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

/** Steps/minute at moderate-intensity walking pace (Tudor-Locke & Rowe, 2012). */
const MODERATE_PACE_STEPS_PER_MINUTE = 100;
/** Compendium of Physical Activities code 17190, "walking, 2.8-3.2 mph, level,
 * moderate pace, firm surface" — the same primary source cited above for
 * ACTIVITY_PRESETS. */
const WALKING_MET = 3.5;

/**
 * Estimate calories burned from a day's step count, scaled by the user's own
 * weight rather than a flat reference figure (unlike ACTIVITY_PRESETS, this is
 * a fresh calculation with no inherited reference-weight assumption to carry).
 * Rounded to the nearest kcal, same as caloriesBurnedForPreset.
 */
export function estimateStepsCalories(steps: number, weightKg: number): number {
  const minutesWalked = steps / MODERATE_PACE_STEPS_PER_MINUTE;

  return Math.round((minutesWalked * WALKING_MET * 3.5 * weightKg) / 200);
}
