import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import * as diaryRepository from '@/data/diaryRepository';
import * as gamificationRepository from '@/data/gamificationRepository';
import { useInterstitialStore } from '@/features/gamification/interstitialStore';
import { useProfileStore } from '@/features/profile/store';
import { useSettingsStore } from '@/features/settings/store';
import { todayKey } from '@/lib/date';
import { queryKeys } from '@/lib/queryClient';

function useUserId(): string | null {
  return useProfileStore((state) => state.profile?.id ?? null);
}

/**
 * The single exit point every UC-22-triggering log flow calls instead of
 * dismissing the modal stack directly.
 *
 * Reads today straight from the repository rather than a query hook's
 * `data`: `onSuccess` fires as soon as the write commits, before the
 * invalidated `useDiaryDay` query has had a chance to refetch, so a query
 * hook's snapshot here would be one entry behind — missing the very thing
 * that was just logged.
 */
export function usePostLogInterstitial() {
  const userId = useUserId();
  const hideChallengeProgress = useSettingsStore((state) => state.hideChallengeProgress);
  const present = useInterstitialStore((state) => state.present);
  const queryClient = useQueryClient();

  return () => {
    if (!userId || hideChallengeProgress) {
      router.dismissAll();
      return;
    }

    const day = diaryRepository.getDiaryDay(userId, todayKey());
    const quests = gamificationRepository.evaluateQuestProgress(userId, day);

    void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });

    present(quests);
    router.push('/log/interstitial');
  };
}

/** Every quest active right now — today's daily set plus this week's weekly set (UC-23). */
export function useActiveQuests() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.gamification.quests(todayKey()),
    queryFn: () => {
      if (!userId) throw new Error('No local profile yet.');

      const day = diaryRepository.getDiaryDay(userId, todayKey());

      return gamificationRepository.evaluateQuestProgress(userId, day);
    },
    enabled: userId !== null,
    retry: false,
  });
}
