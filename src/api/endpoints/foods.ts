import { z } from 'zod';

import { api } from '@/api/client';
import { foodSchema, paginatedSchema } from '@/api/schemas';
import type { PaginatedResponse } from '@/api/schemas';
import type { Food, Nutrition, ServingUnit } from '@/types/models';

const foodPageSchema = paginatedSchema(foodSchema);
const foodListSchema = z.array(foodSchema);

export interface FoodSearchParams {
  query: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface CreateFoodPayload {
  name: string;
  brand?: string;
  barcode?: string;
  per100g: Nutrition;
  servingUnits: Omit<ServingUnit, 'id'>[];
}

export const foodsApi = {
  /**
   * Free-text catalog search. Pass the `signal` from the caller so a superseded
   * keystroke's request is aborted rather than racing the current one.
   */
  search: ({
    query,
    cursor,
    limit = 20,
    signal,
  }: FoodSearchParams): Promise<PaginatedResponse<Food>> =>
    api.get('foods/search', {
      query: { q: query, cursor, limit },
      schema: foodPageSchema,
      signal,
    }),

  byId: (id: string): Promise<Food> => api.get(`foods/${id}`, { schema: foodSchema }),

  /** Barcode lookup from the scanner. Rejects with a `not_found` ApiError if unknown. */
  byBarcode: (barcode: string): Promise<Food> =>
    api.get(`foods/barcode/${encodeURIComponent(barcode)}`, { schema: foodSchema }),

  /** Foods the user logs most often, for the top of the search screen. */
  frequent: (limit = 20): Promise<Food[]> =>
    api.get('foods/frequent', { query: { limit }, schema: foodListSchema }),

  recent: (limit = 20): Promise<Food[]> =>
    api.get('foods/recent', { query: { limit }, schema: foodListSchema }),

  create: (payload: CreateFoodPayload): Promise<Food> =>
    api.post('foods', payload, { schema: foodSchema }),

  update: (id: string, patch: Partial<CreateFoodPayload>): Promise<Food> =>
    api.patch(`foods/${id}`, patch, { schema: foodSchema }),

  remove: (id: string): Promise<void> => api.delete(`foods/${id}`),
};
