import { z } from 'zod';

/**
 * Wire schemas.
 *
 * These describe what the backend sends, and they are the only place that
 * knowledge lives. `src/types/models.ts` stays hand-written so the domain
 * model can differ from the transport when it needs to.
 *
 * Every schema is `.loose()` where the backend may add fields: a new field on
 * the server must never break an installed client.
 */

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const sexSchema = z.enum(['male', 'female']);
export const activityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export const goalKindSchema = z.enum(['lose', 'maintain', 'gain']);

/** `yyyy-MM-dd`. */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd');

export const nutritionSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative().optional(),
  sugar: z.number().nonnegative().optional(),
  sodium: z.number().nonnegative().optional(),
  saturatedFat: z.number().nonnegative().optional(),
});

export const servingUnitSchema = z.object({
  id: z.string(),
  label: z.string(),
  grams: z.number().positive(),
});

export const foodSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  imageUrl: z.url().optional(),
  per100g: nutritionSchema,
  servingUnits: z.array(servingUnitSchema),
  isCustom: z.boolean().optional(),
  verified: z.boolean().optional(),
});

export const foodEntrySchema = z.object({
  id: z.string(),
  date: dateKeySchema,
  mealType: mealTypeSchema,
  food: foodSchema,
  quantity: z.number().positive(),
  servingUnitId: z.string(),
  nutrition: nutritionSchema,
  notes: z.string().optional(),
  photoUri: z.string().optional(),
  loggedAt: z.iso.datetime(),
});

export const nutritionGoalsSchema = z.object({
  calories: z.number().positive(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string().optional(),
  avatarUrl: z.url().optional(),
  sex: sexSchema,
  age: z.number().int().positive(),
  heightCm: z.number().positive(),
  weightKg: z.number().positive(),
  activityLevel: activityLevelSchema,
  goalKind: goalKindSchema,
  weeklyRateKg: z.number().nonnegative(),
  customGoals: nutritionGoalsSchema.optional(),
});

export const diaryDaySchema = z.object({
  date: dateKeySchema,
  entries: z.array(foodEntrySchema),
  totals: nutritionSchema,
  goals: nutritionGoalsSchema,
  exerciseCalories: z.number().nonnegative().default(0),
  waterMl: z.number().nonnegative().default(0),
});

export const weightLogSchema = z.object({
  id: z.string(),
  date: dateKeySchema,
  weightKg: z.number().positive(),
});

export const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().int().positive(),
  user: userProfileSchema,
});

/** A page of results from a list endpoint. */
export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    /** Opaque cursor for the next page; absent on the last page. */
    nextCursor: z.string().nullish(),
    total: z.number().int().nonnegative().optional(),
  });
}

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor?: string | null;
  total?: number;
};
