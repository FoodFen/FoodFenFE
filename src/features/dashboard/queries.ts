import { useQuery } from '@tanstack/react-query';

import * as diaryRepository from '@/data/diaryRepository';
import { getCoinBalance } from '@/data/gamificationRepository';
import { getWeightAsOf } from '@/data/logRepository';
import { readWithRefresh } from '@/data/sync';
import { pullDiaryWindow } from '@/features/diary/queries';
import { useProfileStore } from '@/features/profile/store';
import type { DateKey } from '@/lib/date';
import { calendarWeek } from '@/lib/date';
import { queryKeys } from '@/lib/queryClient';

/**
 * Dashboard reads.
 *
 * The dashboard already gets the selected day from `useDiaryDay`; these cover
 * the two extra things it shows — the seven-day strip and the coin balance in
 * the header. Both follow the same local-first pattern as `src/features/diary`:
 * refresh from the server when one is reachable, then answer from local rows.
 */

function useUserId(): string | null {
  return useProfileStore((state) => state.profile?.id ?? null);
}

/**
 * The seven days the strip shows — the fixed Monday–Sunday calendar week that
 * contains the centre date, so the strip never shifts under the user's thumb.
 */
export function useDiaryWeek(centerDate: DateKey) {
  const userId = useUserId();
  const week = calendarWeek(centerDate);
  const from = week[0] ?? centerDate;
  const to = week[week.length - 1] ?? centerDate;

  return useQuery({
    queryKey: queryKeys.diary.range(from, to),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return readWithRefresh({
        pull: () => pullDiaryWindow(userId, from, to),
        read: () => diaryRepository.getDiaryRange(userId, from, to),
      });
    },
    enabled: userId !== null,
    retry: false,
  });
}

/**
 * The weigh-in in force as of `date`, for the weight card's headline number and delta.
 *
 * `?? null` because TanStack Query rejects an `undefined` result. Local-only —
 * `useLogWeight` already invalidates `queryKeys.weight.all`, which covers this.
 */
export function useWeightAsOf(date: DateKey) {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.weight.asOf(date),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return getWeightAsOf(userId, date) ?? null;
    },
    enabled: userId !== null,
    retry: false,
  });
}

/** The coin balance shown in the header. Local-only — coins are not synced yet. */
export function useCoinBalance() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.gamification.coins(),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      return getCoinBalance(userId);
    },
    enabled: userId !== null,
    retry: false,
  });
}
