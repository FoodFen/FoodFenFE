import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi } from '@/api/endpoints/auth';
import { useAuthStore } from '@/features/auth/store';
import { queryKeys } from '@/lib/queryClient';
import type { UserProfile } from '@/types/models';

/**
 * Save profile changes.
 *
 * The updated profile is written back into the auth store as well as the query
 * cache: body stats drive `calculateGoals`, and screens read them from the
 * session rather than issuing their own query.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (patch: Partial<UserProfile>) => authApi.updateProfile(patch),

    onSuccess: (updated) => {
      setUser(updated);
      queryClient.setQueryData(queryKeys.auth.me(), updated);

      // Targets changed, so every cached day's goal figures are now stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });
    },
  });
}
