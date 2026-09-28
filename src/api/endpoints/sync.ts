import { z } from 'zod';

import { api } from '@/api/client';
import {
  activityLogSchema,
  coinTransactionSchema,
  dailyGoalSchema,
  foodEntrySchema,
  questSchema,
  streakSchema,
  userSchema,
  waterLogSchema,
  weightLogSchema,
} from '@/api/schemas';
import type {
  RemoteActivityLog,
  RemoteCoinTransaction,
  RemoteDailyGoal,
  RemoteFoodEntry,
  RemoteQuest,
  RemoteStreak,
  RemoteUser,
  RemoteWaterLog,
  RemoteWeightLog,
} from '@/api/schemas';
import type { DateKey } from '@/lib/date';
import type {
  AiFeedback,
  ActivitySource,
  CoinReason,
  InputMethod,
  MealType,
  QuestCadence,
  QuestType,
  UserProfile,
} from '@/types/models';

/**
 * The server-side resources, one per ERD table. See
 * `docs/backend-contracts/sync.md` for the full wire contract both halves
 * below are built against.
 *
 * Reads are called through `readWithRefresh` in `src/data/sync.ts`, which
 * falls back to the device database whenever any of this fails, so an
 * unreachable server never blocks a screen that already has local data.
 *
 * Writes are called through `src/data/push.ts`, one row at a time — not a
 * batch envelope, per the contract. Every create carries `clientId` (the
 * row's local id) purely for retry-safe idempotency; it is never the row's
 * real identity, which stays the server's own `id` once assigned.
 */

const foodEntryListSchema = z.array(foodEntrySchema);
const dailyGoalListSchema = z.array(dailyGoalSchema);
const activityListSchema = z.array(activityLogSchema);
const weightListSchema = z.array(weightLogSchema);
const waterListSchema = z.array(waterLogSchema);

export type PushUserInput = Pick<
  UserProfile,
  | 'displayName'
  | 'gender'
  | 'birthYear'
  | 'unitSystem'
  | 'height'
  | 'weightCurrent'
  | 'weightGoal'
  | 'activityLevel'
  | 'dietType'
  | 'calorieCalcMode'
  | 'calorieLeftMode'
  | 'weeklyRateKg'
>;

export interface PushGoalInput {
  clientId: string;
  targetKcal: number;
  targetCarbsG: number;
  targetProteinG: number;
  targetFatG: number;
  targetWaterMl: number;
  effectiveDate: DateKey;
}

/**
 * No `clientId` — unlike every other pushed resource, a streak is a
 * singleton per account (there is exactly one row, ever), so there is no
 * "which one" for an id to disambiguate. Naturally idempotent: pushing the
 * same numbers twice just upserts to the same result.
 */
export interface PushStreakInput {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: DateKey | null;
}

export interface PushIngredientInput {
  clientId: string;
  name: string;
  quantityG: number;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number | null;
}

export interface PushFoodEntryInput {
  clientId: string;
  name: string;
  inputMethod: InputMethod;
  imageUrl: string | null;
  totalKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number | null;
  aiFeedback: AiFeedback | null;
  mealType: MealType;
  loggedAt: string;
  loggedOn: DateKey;
  ingredients: PushIngredientInput[];
}

export interface PushActivityLogInput {
  clientId: string;
  activityType: string;
  caloriesBurned: number;
  source: ActivitySource;
  loggedAt: string;
  loggedOn: DateKey;
}

export interface PushWeightLogInput {
  clientId: string;
  weight: number;
  recordedAt: DateKey;
}

export interface PushWaterLogInput {
  clientId: string;
  amountMl: number;
  loggedAt: string;
  loggedOn: DateKey;
}

/** No `clientId` — the `:id` in the URL already identifies the row, same as every other PATCH in this API. */
export type UpdateWaterLogInput = Omit<PushWaterLogInput, 'clientId'>;

export interface PushQuestInput {
  clientId: string;
  questType: QuestType;
  target: number;
  rewardCoins: number;
  cadence: QuestCadence;
  completionRatio: number;
  questDate: DateKey;
}

/** No `clientId` — the `:id` in the URL already identifies the row. */
export interface UpdateQuestInput {
  progress: number;
  completed: boolean;
}

/** Append-only — there is no update/delete for a coin transaction. */
export interface PushCoinTransactionInput {
  clientId: string;
  amount: number;
  reason: CoinReason;
  createdAt: string;
}

export const syncApi = {
  me: (signal?: AbortSignal): Promise<RemoteUser> =>
    api.get('auth/me', { schema: userSchema, signal }),

  goals: (signal?: AbortSignal): Promise<RemoteDailyGoal[]> =>
    api.get('daily-goals', { schema: dailyGoalListSchema, signal }),

  /** Every entry in an inclusive day range, ingredients included. */
  foodEntries: (
    from: DateKey,
    to: DateKey,
    signal?: AbortSignal,
  ): Promise<RemoteFoodEntry[]> =>
    api.get('food-entries', {
      query: { from, to },
      schema: foodEntryListSchema,
      signal,
    }),

  activityLogs: (
    from: DateKey,
    to: DateKey,
    signal?: AbortSignal,
  ): Promise<RemoteActivityLog[]> =>
    api.get('activity-logs', { query: { from, to }, schema: activityListSchema, signal }),

  waterLogs: (
    from: DateKey,
    to: DateKey,
    signal?: AbortSignal,
  ): Promise<RemoteWaterLog[]> =>
    api.get('water-logs', { query: { from, to }, schema: waterListSchema, signal }),

  weightLogs: (
    from: DateKey,
    to: DateKey,
    signal?: AbortSignal,
  ): Promise<RemoteWeightLog[]> =>
    api.get('weight-logs', { query: { from, to }, schema: weightListSchema, signal }),

  pushUser: (patch: PushUserInput): Promise<RemoteUser> =>
    api.patch('users/me', patch, { schema: userSchema }),

  /** Upserts on `(userId, effectiveDate)` server-side — always a POST, never a PATCH. */
  pushGoal: (input: PushGoalInput): Promise<RemoteDailyGoal> =>
    api.post('daily-goals', input, { schema: dailyGoalSchema }),

  /** Upserts the account's one streak row — always a POST, never a PATCH. */
  pushStreak: (input: PushStreakInput): Promise<RemoteStreak> =>
    api.post('streak', input, { schema: streakSchema }),

  createFoodEntry: (input: PushFoodEntryInput): Promise<RemoteFoodEntry> =>
    api.post('food-entries', input, { schema: foodEntrySchema }),

  updateFoodEntry: (remoteId: string, input: PushFoodEntryInput): Promise<RemoteFoodEntry> =>
    api.patch(`food-entries/${remoteId}`, input, { schema: foodEntrySchema }),

  deleteFoodEntry: (remoteId: string): Promise<void> => api.delete(`food-entries/${remoteId}`),

  createActivityLog: (input: PushActivityLogInput): Promise<RemoteActivityLog> =>
    api.post('activity-logs', input, { schema: activityLogSchema }),

  updateActivityLog: (
    remoteId: string,
    input: PushActivityLogInput,
  ): Promise<RemoteActivityLog> =>
    api.patch(`activity-logs/${remoteId}`, input, { schema: activityLogSchema }),

  createWeightLog: (input: PushWeightLogInput): Promise<RemoteWeightLog> =>
    api.post('weight-logs', input, { schema: weightLogSchema }),

  createWaterLog: (input: PushWaterLogInput): Promise<RemoteWaterLog> =>
    api.post('water-logs', input, { schema: waterLogSchema }),

  updateWaterLog: (remoteId: string, input: UpdateWaterLogInput): Promise<RemoteWaterLog> =>
    api.patch(`water-logs/${remoteId}`, input, { schema: waterLogSchema }),

  deleteWaterLog: (remoteId: string): Promise<void> => api.delete(`water-logs/${remoteId}`),

  createQuest: (input: PushQuestInput): Promise<RemoteQuest> =>
    api.post('quests', input, { schema: questSchema }),

  updateQuest: (remoteId: string, input: UpdateQuestInput): Promise<RemoteQuest> =>
    api.patch(`quests/${remoteId}`, input, { schema: questSchema }),

  /** Append-only — there is no update/delete endpoint for a coin transaction. */
  createCoinTransaction: (input: PushCoinTransactionInput): Promise<RemoteCoinTransaction> =>
    api.post('coin-transactions', input, { schema: coinTransactionSchema }),
};
