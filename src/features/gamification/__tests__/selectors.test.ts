import type { Quest, QuestType } from '@/types/models';

import { questDescription, questTitle, shouldAnnounce } from '../selectors';

function t(namespace: 'questTitles' | 'questDescriptions', key: string): string {
  return `${namespace}:${key}`;
}

function baseQuest(overrides: Partial<Quest>): Quest {
  return {
    id: 'quest-1',
    userId: 'user-1',
    questType: 'log_all_meals',
    progress: 0,
    target: 1,
    rewardCoins: 10,
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

describe('questTitle', () => {
  it('looks up the i18n title for an active quest type', () => {
    expect(questTitle(t, 'drink_water')).toBe('questTitles:drink_water');
  });

  it('falls back to the raw quest type for one the app never issues', () => {
    expect(questTitle(t, 'log_breakfast' as QuestType)).toBe('log_breakfast');
  });
});

describe('questDescription', () => {
  const withPlaceholders = (_: 'questTitles' | 'questDescriptions', key: string) => {
    if (key === 'drink_water') return 'Drink {target} glasses';
    if (key === 'hit_calorie_goal') return 'Reach {percent}% of your goal';

    return key;
  };

  it('substitutes {target} for a target-based quest', () => {
    const quest = baseQuest({ questType: 'drink_water', target: 8 });

    expect(questDescription(withPlaceholders, quest)).toBe('Drink 8 glasses');
  });

  it('substitutes {percent} for hit_calorie_goal, rounding the ratio', () => {
    const quest = baseQuest({ questType: 'hit_calorie_goal', completionRatio: 0.874 });

    expect(questDescription(withPlaceholders, quest)).toBe('Reach 87% of your goal');
  });

  it('returns an empty string for a quest type with no description copy', () => {
    const quest = baseQuest({ questType: 'log_breakfast' as QuestType });

    expect(questDescription(t, quest)).toBe('');
  });
});

describe('shouldAnnounce', () => {
  it('announces the first advance', () => {
    expect(shouldAnnounce(1, false)).toBe(true);
  });

  it('stays quiet on the second, third, etc. odd advance', () => {
    expect(shouldAnnounce(3, false)).toBe(false);
    expect(shouldAnnounce(5, false)).toBe(false);
  });

  it('announces every even advance', () => {
    expect(shouldAnnounce(2, false)).toBe(true);
    expect(shouldAnnounce(4, false)).toBe(true);
  });

  it('always announces the advance that completes the quest, even on an odd count', () => {
    expect(shouldAnnounce(3, true)).toBe(true);
    expect(shouldAnnounce(7, true)).toBe(true);
  });
});
