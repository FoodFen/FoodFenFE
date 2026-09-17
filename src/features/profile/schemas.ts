import { z } from 'zod';

import type { useTranslation } from '@/hooks/useTranslation';

/**
 * The body-stat form, shared by first-run onboarding and the goals editor.
 *
 * Separate from `src/api/schemas.ts`: those describe what a server sends,
 * these describe what a person may type, and the messages here are written to
 * appear under a field rather than in a log. `makeBodyStatsSchema` is a
 * factory over `t` rather than a static schema, so the messages follow the
 * current locale instead of always being English.
 *
 * `z.coerce` throughout the numeric fields because `TextInput` only ever hands
 * back strings.
 */

type Translate = ReturnType<typeof useTranslation>['t'];

const CURRENT_YEAR = new Date().getFullYear();

export function makeBodyStatsSchema(t: Translate) {
  return z
    .object({
      gender: z.enum(['male', 'female', 'other']),
      birthYear: z.coerce
        .number<number>()
        .int()
        .min(CURRENT_YEAR - 120, t('profileBodyStats', 'birthYearError'))
        .max(CURRENT_YEAR - 13, t('profileBodyStats', 'birthYearTooYoungError')),
      /** Centimetres. */
      height: z.coerce.number<number>().min(100, t('profileBodyStats', 'heightError')).max(250),
      /** Kilograms. */
      weightCurrent: z.coerce
        .number<number>()
        .min(30, t('profileBodyStats', 'weightCurrentError'))
        .max(400),
      /** Kilograms. */
      weightGoal: z.coerce
        .number<number>()
        .min(30, t('profileBodyStats', 'weightGoalError'))
        .max(400),
      activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
      dietType: z.enum(['balanced', 'low_carb', 'high_protein', 'keto', 'vegetarian']),
      weeklyRateKg: z.coerce.number<number>().min(0).max(1.5),
    })
    .refine(
      // A goal that differs from current weight but with no pace set would
      // silently compute a maintenance target, which is not what was asked for.
      (values) =>
        Math.abs(values.weightGoal - values.weightCurrent) < 0.5 || values.weeklyRateKg > 0,
      { message: t('profileBodyStats', 'paceRequiredError'), path: ['weeklyRateKg'] },
    );
}

export type BodyStatsValues = z.infer<ReturnType<typeof makeBodyStatsSchema>>;

/** Manual daily targets, for users who set their own numbers. */
export const manualGoalSchema = z.object({
  targetKcal: z.coerce
    .number<number>()
    .int()
    .min(800, 'That is too low to be safe.')
    .max(10000),
  targetProteinG: z.coerce.number<number>().min(0).max(1000),
  targetCarbsG: z.coerce.number<number>().min(0).max(1000),
  targetFatG: z.coerce.number<number>().min(0).max(1000),
  targetWaterMl: z.coerce.number<number>().int().min(0).max(10000),
});

export type ManualGoalValues = z.infer<typeof manualGoalSchema>;
