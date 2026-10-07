import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { pullDailyGoals } from '@/data/pull';
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
 * Pulls the account's daily goals and recent diary history once per launch /
 * sign-in (retrying a sign-in goals fetch that failed), then invalidates the
 * diary queries, which also carry the goals, so the screens repaint with it. The per-read
 * pulls only cover the day or range a screen is showing and land after that
 * screen has already read, so without this a fresh sign-in shows nothing but
 * today until something else triggers a refetch.
 */
export function useAccountHydration(): void {
  const profileId = useProfileStore((state) => state.profile?.id ?? null);
  const accountId = useAuthStore((state) => state.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const online = useSyncExternalStore(onlineManager.subscribe, () => onlineManager.isOnline());

  useEffect(() => {
    if (!profileId || accountId === null || !canUseRemote()) return;

    const key = `${accountId}:${profileId}`;
    if (hydratedFor === key) return;
    hydratedFor = key;

    const today = todayKey();

    Promise.all([
      pullDailyGoals(profileId),
      pullDiaryWindow(profileId, shiftDateKey(today, -HYDRATE_DAYS), today),
    ])
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
  }, [profileId, accountId, online, queryClient]);
}
