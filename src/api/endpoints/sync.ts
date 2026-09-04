import { z } from 'zod';

import { api } from '@/api/client';
import {
  activityLogSchema,
  dailyGoalSchema,
  foodEntrySchema,
  userSchema,
  waterLogSchema,
  weightLogSchema,
} from '@/api/schemas';
import type {
  RemoteActivityLog,
  RemoteDailyGoal,
  RemoteFoodEntry,
  RemoteUser,
  RemoteWaterLog,
  RemoteWeightLog,
} from '@/api/schemas';
import type { DateKey } from '@/lib/date';

/**
 * The server-side resources, one per ERD table.
 *
 * Called only through `readThrough` in `src/data/sync.ts`, which falls back to
 * the device database whenever any of this fails — which, with no backend
 * deployed, is currently always. Defining it now is what lets the offline path
 * be the fallback rather than the only path.
 *
 * Writes are absent on purpose: every write is local-first and marked
 * unsynced, and the push pass that drains them is not built yet.
 */

const foodEntryListSchema = z.array(foodEntrySchema);
const dailyGoalListSchema = z.array(dailyGoalSchema);
const activityListSchema = z.array(activityLogSchema);
const weightListSchema = z.array(weightLogSchema);
const waterListSchema = z.array(waterLogSchema);

export const syncApi = {
  me: (signal?: AbortSignal): Promise<RemoteUser> =>
    api.get('users/me', { schema: userSchema, signal }),

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
};
