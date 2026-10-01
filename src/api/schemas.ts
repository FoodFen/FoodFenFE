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
/** `coin_redeem` — a coin-shop grant (`POST /coins/redeem`), never a checkout `planType` request. */
export const planTypeSchema = z.enum(['monthly', 'annual', 'coin_redeem']);
export const paymentStatusSchema = z.enum([
  'pending',
  'paid',
  'cancelled',
  'expired',
  'failed',
]);
export const subscriptionStatusSchema = z.enum(['active', 'canceled', 'expired', 'trial']);
export const questTypeSchema = z.enum([
  'log_breakfast',
  'log_all_meals',
  'hit_calorie_goal',
  'hit_protein_goal',
  'drink_water',
  'log_weight',
  'stay_active_week',
]);
export const questCadenceSchema = z.enum(['daily', 'weekly']);
export const coinReasonSchema = z.enum([
  'quest_completed',
  'streak_bonus',
  'purchase',
  'spend',
  'adjustment',
]);

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

/** A singleton per account, upserted rather than keyed by any date — see `pushGoal` vs `pushStreak`. */
export const streakSchema = z.object({
  id: z.string(),
  userId: z.number().int(),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  lastActiveDate: dateKeySchema.nullable(),
});

export const questSchema = z.object({
  id: z.string(),
  userId: z.number().int(),
  questType: questTypeSchema,
  progress: z.number().int().nonnegative(),
  target: z.number().int().nonnegative(),
  rewardCoins: z.number().int().nonnegative(),
  completed: z.boolean(),
  cadence: questCadenceSchema,
  completionRatio: z.number().min(0).max(1),
  questDate: dateKeySchema,
});

/** Append-only ledger row — never edited or removed once pushed. */
export const coinTransactionSchema = z.object({
  id: z.string(),
  userId: z.number().int(),
  amount: z.number().int(),
  reason: coinReasonSchema,
  createdAt: z.iso.datetime(),
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

const aiQuotaSlotSchema = z.object({
  limit: z.number().int(),
  remaining: z.number().int(),
});

/** Free-trial tries left per input method; slots are null when `unlimited`. */
export const aiQuotaResponseSchema = z.object({
  unlimited: z.boolean(),
  image: aiQuotaSlotSchema.nullable(),
  text: aiQuotaSlotSchema.nullable(),
  voice: aiQuotaSlotSchema.nullable(),
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
  // `POST /coins/redeem` sends this as a decimal string ("0.00"); every other
  // endpoint sends a number. `coerce` accepts both.
  price: z.coerce.number().nonnegative(),
});

export const subscriptionMeResponseSchema = z.object({
  hasActiveSubscription: z.boolean(),
  subscription: subscriptionInfoSchema.nullable(),
});

/** One quest, as `GET /quests` reports it — no `userId` (inferred from the token). */
export const questProgressSchema = z.object({
  id: z.string(),
  questType: questTypeSchema,
  cadence: questCadenceSchema,
  questDate: dateKeySchema,
  progress: z.number().int().nonnegative(),
  target: z.number().int().nonnegative(),
  rewardCoins: z.number().int().nonnegative(),
  completed: z.boolean(),
});

export const questsResponseSchema = z.object({
  balance: z.number().int(),
  quests: z.array(questProgressSchema),
});

export const redeemCoinsResponseSchema = z.object({
  balance: z.number().int(),
  subscription: subscriptionInfoSchema,
});

export type RemoteUser = z.infer<typeof userSchema>;
export type RemoteDailyGoal = z.infer<typeof dailyGoalSchema>;
export type RemoteStreak = z.infer<typeof streakSchema>;
export type RemoteQuest = z.infer<typeof questSchema>;
export type RemoteCoinTransaction = z.infer<typeof coinTransactionSchema>;
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
export type RemoteAiQuotaResponse = z.infer<typeof aiQuotaResponseSchema>;
export type RemoteCheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export type RemotePaymentStatusResponse = z.infer<typeof paymentStatusResponseSchema>;
export type RemoteSubscriptionInfo = z.infer<typeof subscriptionInfoSchema>;
export type RemoteSubscriptionMeResponse = z.infer<typeof subscriptionMeResponseSchema>;
export type RemoteQuestProgress = z.infer<typeof questProgressSchema>;
export type RemoteQuestsResponse = z.infer<typeof questsResponseSchema>;
export type RemoteRedeemCoinsResponse = z.infer<typeof redeemCoinsResponseSchema>;
