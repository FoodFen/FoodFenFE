import type { Quest } from '@/types/models';

import { MAX_TOAST_ENTRIES, useQuestToastStore } from '../toastStore';

function fakeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'quest-1',
    userId: 'user-1',
    questType: 'drink_water',
    progress: 3,
    target: 8,
    rewardCoins: 20,
    completed: false,
    cadence: 'daily',
    completionRatio: 1,
    questDate: '2026-03-02',
    remoteId: null,
    updatedAt: new Date(),
    syncedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  useQuestToastStore.setState({ entries: [], token: 0 });
});

describe('useQuestToastStore', () => {
  it('starts with no entries', () => {
    expect(useQuestToastStore.getState().entries).toEqual([]);
  });

  it('show() stores the entries and bumps the token', () => {
    const entries = [{ quest: fakeQuest(), completed: false }];

    useQuestToastStore.getState().show(entries);

    expect(useQuestToastStore.getState().entries).toEqual(entries);
    expect(useQuestToastStore.getState().token).toBe(1);
  });

  it('bumps the token on every call, even for the same entries', () => {
    const entries = [{ quest: fakeQuest(), completed: false }];

    useQuestToastStore.getState().show(entries);
    useQuestToastStore.getState().show(entries);

    expect(useQuestToastStore.getState().token).toBe(2);
  });

  it('caps entries at MAX_TOAST_ENTRIES', () => {
    const entries = Array.from({ length: MAX_TOAST_ENTRIES + 2 }, (_, i) => ({
      quest: fakeQuest({ id: `quest-${i}` }),
      completed: false,
    }));

    useQuestToastStore.getState().show(entries);

    expect(useQuestToastStore.getState().entries).toHaveLength(MAX_TOAST_ENTRIES);
  });

  it('hide() clears the entries without touching the token', () => {
    useQuestToastStore.getState().show([{ quest: fakeQuest(), completed: true }]);
    useQuestToastStore.getState().hide();

    expect(useQuestToastStore.getState().entries).toEqual([]);
    expect(useQuestToastStore.getState().token).toBe(1);
  });
});
