import { api } from '@/api/client';
import { dishListSchema, publicRestaurantSchema } from '@/api/schemas';
import type { RemoteDishList, RemotePublicRestaurant } from '@/api/schemas';
import type { DateKey } from '@/lib/date';

export type DishFilters = {
  q?: string;
  fits?: boolean;
  kcalMin?: number;
  kcalMax?: number;
  priceMin?: number;
  priceMax?: number;
  proteinMin?: number;
};

export type DishListParams = { date: DateKey; cursor?: string; limit?: number } & DishFilters;

/** Diner view of the marketplace: FoodFenBE `docs/marketplace.md` → "Dish tab". */
export const dishesApi = {
  /** Already ordered by the server (fits first); the client must not re-sort. */
  list: (params: DishListParams, signal?: AbortSignal): Promise<RemoteDishList> =>
    api.get('dishes', { query: params, schema: dishListSchema, signal }),

  restaurant: (id: string, signal?: AbortSignal): Promise<RemotePublicRestaurant> =>
    api.get(`restaurants/${encodeURIComponent(id)}`, {
      schema: publicRestaurantSchema,
      signal,
    }),
};
