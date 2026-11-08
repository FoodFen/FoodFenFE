import { api } from '@/api/client';
import { nutritionTipsResponseSchema } from '@/api/schemas';

/** Public list of short nutrition facts shown while an AI analysis runs. */
export const nutritionTipsApi = {
  list: (signal?: AbortSignal) =>
    api.get('nutrition-tips', { schema: nutritionTipsResponseSchema, signal }),
};
