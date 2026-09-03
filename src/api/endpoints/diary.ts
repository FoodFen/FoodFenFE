import { z } from 'zod';

import { api } from '@/api/client';
import { diaryDaySchema, foodEntrySchema, weightLogSchema } from '@/api/schemas';
import type { DateKey } from '@/lib/date';
import type { DiaryDay, FoodEntry, MealType, WeightLog } from '@/types/models';

const diaryRangeSchema = z.array(diaryDaySchema);
const weightLogListSchema = z.array(weightLogSchema);

export interface CreateEntryPayload {
  date: DateKey;
  mealType: MealType;
  foodId: string;
  quantity: number;
  servingUnitId: string;
  notes?: string;
  photoUri?: string;
}

export interface UpdateEntryPayload {
  quantity?: number;
  servingUnitId?: string;
  mealType?: MealType;
  date?: DateKey;
  notes?: string;
}

export const diaryApi = {
  /** One day of the diary, totals already summed by the server. */
  day: (date: DateKey, signal?: AbortSignal): Promise<DiaryDay> =>
    api.get(`diary/${date}`, { schema: diaryDaySchema, signal }),

  /** Inclusive date range, used by the trends screen. */
  range: (from: DateKey, to: DateKey, signal?: AbortSignal): Promise<DiaryDay[]> =>
    api.get('diary', { query: { from, to }, schema: diaryRangeSchema, signal }),

  createEntry: (payload: CreateEntryPayload): Promise<FoodEntry> =>
    api.post('diary/entries', payload, { schema: foodEntrySchema }),

  updateEntry: (id: string, patch: UpdateEntryPayload): Promise<FoodEntry> =>
    api.patch(`diary/entries/${id}`, patch, { schema: foodEntrySchema }),

  deleteEntry: (id: string): Promise<void> => api.delete(`diary/entries/${id}`),

  /** Copy a whole meal from one day to another — "repeat yesterday's lunch". */
  copyMeal: (params: {
    fromDate: DateKey;
    toDate: DateKey;
    mealType: MealType;
  }): Promise<FoodEntry[]> =>
    api.post('diary/copy-meal', params, { schema: z.array(foodEntrySchema) }),

  setWater: (date: DateKey, waterMl: number): Promise<void> =>
    api.put(`diary/${date}/water`, { waterMl }),

  logWeight: (date: DateKey, weightKg: number): Promise<WeightLog> =>
    api.post('diary/weight', { date, weightKg }, { schema: weightLogSchema }),

  weightHistory: (from: DateKey, to: DateKey): Promise<WeightLog[]> =>
    api.get('diary/weight', { query: { from, to }, schema: weightLogListSchema }),
};
