import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import { pullDiaryWindow } from '@/features/diary/queries';
import { useProfileStore } from '@/features/profile/store';
import { shiftDateKey, todayKey } from '@/lib/date';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';

const HYDRATE_DAYS = 90;

let hydratedFor: string | null = null;

/**
 * Pulls the account's recent diary history once per launch / sign-in, then
 * invalidates the diary queries so the screens repaint with it. The per-read
 * pulls only cover the day or range a screen is showing and land after that
 * screen has already read, so without this a fresh sign-in shows nothing but
 * today until something else triggers a refetch.
 */
export function useAccountHydration(): void {
  const profileId = useProfileStore((state) => state.profile?.id ?? null);
  const accountId = useAuthStore((state) => state.session?.user.id ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId || accountId === null || !canUseRemote()) return;

    const key = `${accountId}:${profileId}`;
    if (hydratedFor === key) return;
    hydratedFor = key;

    const today = todayKey();

    pullDiaryWindow(profileId, shiftDateKey(today, -HYDRATE_DAYS), today)
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.diary.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.entries.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.weight.all }),
        ]),
      )
      .catch((error: unknown) => {
        hydratedFor = null;
        if (env.isDev) console.warn('[sync] History pull failed.', error);
      });
  }, [profileId, accountId, queryClient]);
}
