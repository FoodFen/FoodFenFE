import { api } from '@/api/client';
import { equipMascotResponseSchema, mascotCatalogResponseSchema } from '@/api/schemas';

/**
 * Server-owned mascot catalogue, ownership and equipped choice. Purchase
 * errors: 404 unknown id, 409 `mascot_already_owned`, 409 with no `code` =
 * insufficient coins. Equip errors: 404 unknown id, 409 `mascot_not_owned`.
 */
export const mascotsApi = {
  list: (signal?: AbortSignal) =>
    api.get('mascots', { schema: mascotCatalogResponseSchema, signal }),

  /** Does not equip; responds with the refreshed catalogue. */
  purchase: (id: string) =>
    api.post(`mascots/${encodeURIComponent(id)}/purchase`, undefined, {
      schema: mascotCatalogResponseSchema,
    }),

  equip: (mascotId: string) =>
    api.put('mascots/equipped', { mascotId }, { schema: equipMascotResponseSchema }),
};
