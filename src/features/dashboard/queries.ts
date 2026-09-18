import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import * as diaryRepository from '@/data/diaryRepository';
import { getCoinBalance } from '@/data/gamificationRepository';
import * as logRepository from '@/data/logRepository';
import { getWeightAsOf } from '@/data/logRepository';
import { readWithRefresh } from '@/data/sync';
import { pullDiaryWindow } from '@/features/diary/queries';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { estimateStepsCalories } from '@/lib/activity';
import type { DateKey } from '@/lib/date';
import { calendarWeek } from '@/lib/date';
import { getHealthProvider } from '@/lib/health';
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

/**
 * Today's (or a viewed past day's) step count and its estimated calorie
 * contribution, read from whichever HealthProvider this platform has.
 *
 * The read-through write: a successful read is immediately persisted via
 * `upsertHealthSteps` (idempotent per day, per source — see its own doc
 * comment) and the diary invalidated, so `exerciseKcal` picks it up the same
 * way any other logged activity does. Disabled entirely while the user
 * hasn't opted in via Settings.
 */
export function useHealthSteps(date: DateKey) {
  const userId = useUserId();
  const profile = useProfileStore((state) => state.profile);
  const healthSyncEnabled = useSettingsStore((state) => state.healthSyncEnabled);
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.health.steps(date),
    queryFn: async () => {
      if (!userId || !profile) throw new Error('No local profile yet.');

      const steps = await getHealthProvider().getStepCount(date);

      if (steps === null) return null;

      const kcal = estimateStepsCalories(steps, profile.weightCurrent);
      const source = Platform.OS === 'ios' ? 'apple_health' : 'google_fit';

      logRepository.upsertHealthSteps(userId, date, kcal, source);
      void queryClient.invalidateQueries({ queryKey: queryKeys.diary.all });

      return { steps, kcal };
    },
    enabled: userId !== null && profile !== null && healthSyncEnabled,
    retry: false,
  });
}
