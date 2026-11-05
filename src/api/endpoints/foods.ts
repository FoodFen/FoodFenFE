import { api } from '@/api/client';
import { catalogResponseSchema } from '@/api/schemas';

/** Public food catalog: `docs/backend-contracts/food-catalog.md`. No auth. */
export const foodsApi = {
  list: (updatedSince?: string, signal?: AbortSignal) =>
    api.get('foods', { query: { updatedSince }, schema: catalogResponseSchema, skipAuth: true, signal }),
};
