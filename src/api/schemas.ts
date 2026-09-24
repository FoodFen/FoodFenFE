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
export const planTypeSchema = z.enum(['monthly', 'annual']);
export const paymentStatusSchema = z.enum([
  'pending',
  'paid',
  'cancelled',
  'expired',
  'failed',
]);
export const subscriptionStatusSchema = z.enum(['active', 'canceled', 'expired', 'trial']);

export const userSchema = z.object({
  id: z.number().int(),
  email: z.email(),
  displayName: z.string().nullish(),
  // Onboarding-collected fields are nullable server-side: a freshly signed-up
  // account has never pushed its local profile (push sync doesn't exist yet —
  // `docs/backend-contracts/sync.md`), so this is the normal shape for every
  // account today, not an edge case. The device's local profile is the actual
  // source of truth for these regardless (`CLAUDE.md`'s local-first design);
  // nothing in the client reads them off the server's copy.
  gender: genderSchema.nullable(),
  birthYear: z.number().int().nullable(),
  unitSystem: unitSystemSchema,
  height: z.number().positive().nullable(),
  weightCurrent: z.number().positive().nullable(),
  weightGoal: z.number().positive().nullable(),
  activityLevel: activityLevelSchema.nullable(),
  dietType: dietTypeSchema.nullable(),
  calorieCalcMode: calorieCalcModeSchema,
  calorieLeftMode: calorieLeftModeSchema.nullable(),
  subscriptionTier: subscriptionTierSchema,
  weeklyRateKg: z.number().nonnegative().nullable(),
  createdAt: z.iso.datetime(),
});

export const dailyGoalSchema = z.object({
  id: z.string(),
  userId: z.number().int(),
  targetKcal: z.number().int().positive(),
  targetCarbsG: z.number().nonnegative(),
  targetProteinG: z.number().nonnegative(),
  targetFatG: z.number().nonnegative(),
  targetWaterMl: z.number().int().nonnegative(),
  effectiveDate: dateKeySchema,
});

export const ingredientSchema = z.object({
  id: z.string(),
  foodEntryId: z.string(),
  name: z.string(),
  quantityG: z.number().nonnegative(),
  kcal: z.number().int().nonnegative(),
  carbsG: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().nullish(),
});

export const foodEntrySchema = z.object({
  id: z.string(),
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
  id: z.string(),
  userId: z.number().int(),
  activityType: z.string(),
  caloriesBurned: z.number().int().nonnegative(),
  source: activitySourceSchema,
  loggedAt: z.iso.datetime(),
  loggedOn: dateKeySchema,
});

export const weightLogSchema = z.object({
  id: z.string(),
  userId: z.number().int(),
  weight: z.number().positive(),
  recordedAt: dateKeySchema,
});

export const waterLogSchema = z.object({
  id: z.string(),
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

export const aiIngredientSchema = z.object({
  name: z.string(),
  quantityG: z.number().nonnegative(),
  kcal: z.number().int().nonnegative(),
  carbsG: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().nullish(),
  /** 0–1, how confident the model is in this specific row. Not stored. */
  confidence: z.number().min(0).max(1),
});

export const aiFoodAnalysisResponseSchema = z.object({
  mealName: z.string(),
  ingredients: z.array(aiIngredientSchema),
  /** Set only when the server persisted the uploaded photo; null for text. */
  imageUrl: z.url().nullish(),
});

export const checkoutResponseSchema = z.object({
  orderCode: z.number().int(),
  checkoutUrl: z.url(),
  qrCode: z.string(),
  amount: z.number().nonnegative(),
  planType: planTypeSchema,
  status: paymentStatusSchema,
});

export const paymentStatusResponseSchema = z.object({
  orderCode: z.number().int(),
  status: paymentStatusSchema,
  amount: z.number().nonnegative(),
  planType: planTypeSchema,
  paidAt: z.iso.datetime().nullish(),
  createdAt: z.iso.datetime(),
});

export const subscriptionInfoSchema = z.object({
  planType: planTypeSchema,
  status: subscriptionStatusSchema,
  startDate: dateKeySchema,
  endDate: dateKeySchema.nullable(),
  price: z.number().nonnegative(),
});

export const subscriptionMeResponseSchema = z.object({
  hasActiveSubscription: z.boolean(),
  subscription: subscriptionInfoSchema.nullable(),
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
export type RemoteAiIngredient = z.infer<typeof aiIngredientSchema>;
export type RemoteAiFoodAnalysisResponse = z.infer<typeof aiFoodAnalysisResponseSchema>;
export type RemoteCheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export type RemotePaymentStatusResponse = z.infer<typeof paymentStatusResponseSchema>;
export type RemoteSubscriptionInfo = z.infer<typeof subscriptionInfoSchema>;
export type RemoteSubscriptionMeResponse = z.infer<typeof subscriptionMeResponseSchema>;
