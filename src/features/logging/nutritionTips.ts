import { useQuery } from '@tanstack/react-query';

import { nutritionTipsApi } from '@/api/endpoints/nutritionTips';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';

/**
 * Nutrition tips for the AI wait screen. A quiet background pull: no retry and
 * no error surface, so a missing endpoint just leaves the bundled list in use.
 * The persisted query cache keeps the last good list available offline.
 */
export function useNutritionTips() {
  return useQuery({
    queryKey: queryKeys.nutritionTips.all,
    queryFn: ({ signal }) =>
      nutritionTipsApi.list(signal).then((response) => response.items),
    enabled: env.hasBackend,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    networkMode: 'always',
    retry: false,
  });
}
