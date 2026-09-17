import type { Quest } from '@/types/models';

import { useInterstitialStore } from '../interstitialStore';

function fakeQuest(id: string): Quest {
  return {
    id,
    userId: 'user-1',
    questType: 'drink_water',
    progress: 1,
    target: 8,
    rewardCoins: 10,
    completed: false,
    cadence: 'daily',
    completionRatio: 1,
    questDate: '2026-03-02',
    remoteId: null,
    updatedAt: new Date(),
    syncedAt: null,
    deletedAt: null,
  };
}

beforeEach(() => {
  useInterstitialStore.setState({ open: false, quests: [] });
});

describe('useInterstitialStore', () => {
  it('starts closed with no quests', () => {
    expect(useInterstitialStore.getState().open).toBe(false);
    expect(useInterstitialStore.getState().quests).toEqual([]);
  });

  it('present() opens the sheet with exactly the quests it was given', () => {
    const quests = [fakeQuest('q1'), fakeQuest('q2')];

    useInterstitialStore.getState().present(quests);

    expect(useInterstitialStore.getState().open).toBe(true);
    expect(useInterstitialStore.getState().quests).toEqual(quests);
  });

  it('dismiss() closes the sheet and clears the quests', () => {
    useInterstitialStore.getState().present([fakeQuest('q1')]);
    useInterstitialStore.getState().dismiss();

    expect(useInterstitialStore.getState().open).toBe(false);
    expect(useInterstitialStore.getState().quests).toEqual([]);
  });
});
