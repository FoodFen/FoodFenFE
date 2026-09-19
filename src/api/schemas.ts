import { z } from 'zod';

/**
 * Wire schemas.
 *
 * What the server sends, and the only place that knowledge lives. The device
 * schema in `src/db/schema.ts` is deliberately separate: it carries local ids
 * and sync bookkeeping the server knows nothing about, and the server carries
 * integer keys the device cannot mint. `src/api/mappers.ts` moves between them.
 *
 * No backend implements this yet — it is the contract the remote read path in
 * `src/data/sync.ts` is written against.
 */

/** `yyyy-MM-dd`. */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected yyyy-MM-dd');

export const genderSchema = z.enum(['male', 'female', 'other']);
export const unitSystemSchema = z.enum(['metric', 'imperial']);
export const activityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export const dietTypeSchema = z.enum([
  'balanced',
  'low_carb',
  'high_protein',
  'keto',
  'vegetarian',
]);
export const calorieCalcModeSchema = z.enum(['auto', 'manual']);
export const calorieLeftModeSchema = z.enum(['smart', 'all_calories']);
export const subscriptionTierSchema = z.enum(['free', 'premium']);
export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const inputMethodSchema = z.enum(['voice', 'image', 'type', 'manual']);
export const aiFeedbackSchema = z.enum(['up', 'down']);
export const activitySourceSchema = z.enum(['manual', 'apple_health', 'google_fit']);

export const userSchema = z.object({
  id: z.number().int(),
  email: z.email(),
  displayName: z.string().nullish(),
  gender: genderSchema,
  birthYear: z.number().int(),
  unitSystem: unitSystemSchema,
  height: z.number().positive(),
  weightCurrent: z.number().positive(),
  weightGoal: z.number().positive(),
  activityLevel: activityLevelSchema,
  dietType: dietTypeSchema,
  calorieCalcMode: calorieCalcModeSchema,
  calorieLeftMode: calorieLeftModeSchema,
  subscriptionTier: subscriptionTierSchema,
  weeklyRateKg: z.number().nonnegative(),
  createdAt: z.iso.datetime(),
});

export const dailyGoalSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  targetKcal: z.number().int().positive(),
  targetCarbsG: z.number().nonnegative(),
  targetProteinG: z.number().nonnegative(),
  targetFatG: z.number().nonnegative(),
  targetWaterMl: z.number().int().nonnegative(),
  effectiveDate: dateKeySchema,
});

export const ingredientSchema = z.object({
  id: z.number().int(),
  foodEntryId: z.number().int(),
  name: z.string(),
  quantityG: z.number().nonnegative(),
  kcal: z.number().int().nonnegative(),
  carbsG: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().nullish(),
});

export const foodEntrySchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  name: z.string(),
  inputMethod: inputMethodSchema,
  imageUrl: z.url().nullish(),
  totalKcal: z.number().int().nonnegative(),
  carbsG: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().nullish(),
  aiFeedback: aiFeedbackSchema.nullish(),
  mealType: mealTypeSchema,
  loggedAt: z.iso.datetime(),
  loggedOn: dateKeySchema,
  ingredients: z.array(ingredientSchema),
});

export const activityLogSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  activityType: z.string(),
  caloriesBurned: z.number().int().nonnegative(),
  source: activitySourceSchema,
  loggedAt: z.iso.datetime(),
  loggedOn: dateKeySchema,
});

export const weightLogSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  weight: z.number().positive(),
  recordedAt: dateKeySchema,
});

export const waterLogSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  amountMl: z.number().int().nonnegative(),
  loggedAt: z.iso.datetime(),
  loggedOn: dateKeySchema,
});

export const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Epoch milliseconds. */
  expiresAt: z.number().int().positive(),
  user: userSchema,
});

export const chatRoleSchema = z.enum(['user', 'assistant']);

export const chatMessageSchema = z.object({
  id: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  createdAt: z.iso.datetime(),
});

export const chatHistoryResponseSchema = z.object({
  messages: z.array(chatMessageSchema),
  nextCursor: z.string().nullable(),
});

export type RemoteUser = z.infer<typeof userSchema>;
export type RemoteDailyGoal = z.infer<typeof dailyGoalSchema>;
export type RemoteFoodEntry = z.infer<typeof foodEntrySchema>;
export type RemoteIngredient = z.infer<typeof ingredientSchema>;
export type RemoteActivityLog = z.infer<typeof activityLogSchema>;
export type RemoteWeightLog = z.infer<typeof weightLogSchema>;
export type RemoteWaterLog = z.infer<typeof waterLogSchema>;
export type RemoteAuthSession = z.infer<typeof authSessionSchema>;
export type RemoteChatMessage = z.infer<typeof chatMessageSchema>;
export type RemoteChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>;
