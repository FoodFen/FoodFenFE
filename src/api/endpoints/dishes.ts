import { api } from '@/api/client';
import { dishListSchema, publicRestaurantSchema } from '@/api/schemas';
import type { RemoteDishList, RemotePublicRestaurant } from '@/api/schemas';
import type { DateKey } from '@/lib/date';

/** Diner view of the marketplace: FoodFenBE `docs/marketplace.md` → "Dish tab". */
export const dishesApi = {
  /** Already ordered by the server (fits first); the client must not re-sort. */
  list: (date: DateKey, signal?: AbortSignal): Promise<RemoteDishList> =>
    api.get('dishes', { query: { date }, schema: dishListSchema, signal }),

  restaurant: (id: string, signal?: AbortSignal): Promise<RemotePublicRestaurant> =>
    api.get(`restaurants/${encodeURIComponent(id)}`, {
      schema: publicRestaurantSchema,
      signal,
    }),
};
