import { z } from 'zod';

/**
 * The body-stat form, shared by first-run onboarding and the goals editor.
 *
 * Separate from `src/api/schemas.ts`: those describe what a server sends,
 * these describe what a person may type, and the messages here are written to
 * appear under a field rather than in a log.
 *
 * `z.coerce` throughout the numeric fields because `TextInput` only ever hands
 * back strings.
 */

const CURRENT_YEAR = new Date().getFullYear();

export const bodyStatsSchema = z
  .object({
    gender: z.enum(['male', 'female', 'other']),
    birthYear: z.coerce
      .number<number>()
      .int()
      .min(CURRENT_YEAR - 120, 'Enter a valid year of birth.')
      .max(CURRENT_YEAR - 13, 'You must be at least 13.'),
    /** Centimetres. */
    height: z.coerce.number<number>().min(100, 'Enter your height in cm.').max(250),
    /** Kilograms. */
    weightCurrent: z.coerce.number<number>().min(30, 'Enter your weight in kg.').max(400),
    /** Kilograms. */
    weightGoal: z.coerce.number<number>().min(30, 'Enter a goal weight in kg.').max(400),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    dietType: z.enum(['balanced', 'low_carb', 'high_protein', 'keto', 'vegetarian']),
    weeklyRateKg: z.coerce.number<number>().min(0).max(1.5),
  })
  .refine(
    // A goal that differs from current weight but with no pace set would
    // silently compute a maintenance target, which is not what was asked for.
    (values) =>
      Math.abs(values.weightGoal - values.weightCurrent) < 0.5 || values.weeklyRateKg > 0,
    { message: 'Choose how fast you want to get there.', path: ['weeklyRateKg'] },
  );

export type BodyStatsValues = z.infer<typeof bodyStatsSchema>;

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
