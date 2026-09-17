import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import { calculateTargets } from '@/lib/nutrition';

import * as gamification from '../gamificationRepository';
import * as logRepository from '../logRepository';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

const input = {
  gender: 'male' as const,
  birthYear: 1990,
  height: 180,
  weightCurrent: 85,
  weightGoal: 78,
  activityLevel: 'moderate' as const,
  dietType: 'balanced' as const,
  weeklyRateKg: 0.5,
};

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('createLocalUser', () => {
  it('creates a guest with no email and no server id', () => {
    const { user } = userRepository.createLocalUser(input);

    // An account is optional, so a fresh profile has neither.
    expect(user.email).toBeNull();
    expect(user.remoteId).toBeNull();
    expect(user.subscriptionTier).toBe('free');
  });

  it('writes an opening goal, so no day is ever without one', () => {
    const { user, goal } = userRepository.createLocalUser(input);

    expect(goal.targetKcal).toBeGreaterThan(0);
    expect(userRepository.getGoalForDate(user.id)).toBeDefined();
  });
});

describe('getGoalForDate', () => {
  it('returns the newest goal effective on or before the day', () => {
    const { user } = userRepository.createLocalUser(input);

    userRepository.setGoal(user.id, targets(1800), '2026-01-01');
    userRepository.setGoal(user.id, targets(2200), '2026-03-01');

    expect(userRepository.getGoalForDate(user.id, '2026-02-15')?.targetKcal).toBe(1800);
    expect(userRepository.getGoalForDate(user.id, '2026-03-02')?.targetKcal).toBe(2200);
  });

  it('leaves past days measured against the goal in force at the time', () => {
    const { user } = userRepository.createLocalUser(input);

    userRepository.setGoal(user.id, targets(1800), '2026-01-01');
    userRepository.setGoal(user.id, targets(2500), '2026-06-01');

    // Changing your goal today must not rewrite what January was aiming for.
    expect(userRepository.getGoalForDate(user.id, '2026-01-15')?.targetKcal).toBe(1800);
  });
});

describe('setGoal', () => {
  it('replaces rather than duplicates a goal for the same date', () => {
    const { user } = userRepository.createLocalUser(input);

    userRepository.setGoal(user.id, targets(1800), '2026-03-01');
    userRepository.setGoal(user.id, targets(1900), '2026-03-01');

    expect(userRepository.getGoalForDate(user.id, '2026-03-01')?.targetKcal).toBe(1900);
  });
});

describe('refreshGoalIfAuto', () => {
  it('recomputes targets for a user on automatic mode', () => {
    const { user } = userRepository.createLocalUser(input);
    const heavier = userRepository.updateLocalUser(user.id, { weightCurrent: 110 });

    const refreshed = userRepository.refreshGoalIfAuto(heavier);

    expect(refreshed).toBeDefined();
    expect(refreshed?.targetKcal).toBeGreaterThan(0);
  });

  it('leaves a manual user their own numbers', () => {
    const { user } = userRepository.createLocalUser(input);

    userRepository.setGoal(user.id, targets(1500));
    const manual = userRepository.updateLocalUser(user.id, {
      calorieCalcMode: 'manual',
    });

    expect(userRepository.refreshGoalIfAuto(manual)).toBeUndefined();
    expect(userRepository.getGoalForDate(user.id)?.targetKcal).toBe(1500);
  });

  it('prefers the latest logged weight over the profile field', () => {
    const { user } = userRepository.createLocalUser(input);

    // `user.weightCurrent` is still 85 (from `input`) — logging a much
    // heavier weigh-in must not require also patching the profile for the
    // formula to notice.
    logRepository.logWeight(user.id, 110, '2026-03-01');

    const refreshed = userRepository.refreshGoalIfAuto(user);
    const expected = calculateTargets({ ...user, weightCurrent: 110 });

    expect(refreshed?.targetKcal).toBe(expected.targetKcal);
    expect(refreshed?.targetKcal).not.toBe(
      calculateTargets({ ...user, weightCurrent: 85 }).targetKcal,
    );
  });
});

describe('streaks', () => {
  it('extends across consecutive days', () => {
    const { user } = userRepository.createLocalUser(input);

    gamification.recordActiveDay(user.id, '2026-03-01');
    gamification.recordActiveDay(user.id, '2026-03-02');
    const streak = gamification.recordActiveDay(user.id, '2026-03-03');

    expect(streak.currentStreak).toBe(3);
    expect(streak.longestStreak).toBe(3);
  });

  it('does not count the same day twice', () => {
    const { user } = userRepository.createLocalUser(input);

    gamification.recordActiveDay(user.id, '2026-03-01');
    const streak = gamification.recordActiveDay(user.id, '2026-03-01');

    // Logging a second meal is not a second day.
    expect(streak.currentStreak).toBe(1);
  });

  it('resets after a gap but keeps the longest run', () => {
    const { user } = userRepository.createLocalUser(input);

    gamification.recordActiveDay(user.id, '2026-03-01');
    gamification.recordActiveDay(user.id, '2026-03-02');
    const afterGap = gamification.recordActiveDay(user.id, '2026-03-05');

    expect(afterGap.currentStreak).toBe(1);
    expect(afterGap.longestStreak).toBe(2);
  });
});

describe('coins and quests', () => {
  it('sums the ledger rather than storing a balance', () => {
    const { user } = userRepository.createLocalUser(input);

    gamification.addCoins(user.id, 50, 'quest_completed');
    gamification.addCoins(user.id, -20, 'spend');

    expect(gamification.getCoinBalance(user.id)).toBe(30);
  });

  it('issues the day’s quests only once', () => {
    const { user } = userRepository.createLocalUser(input);

    const first = gamification.ensureDailyQuests(user.id, '2026-03-01');
    const second = gamification.ensureDailyQuests(user.id, '2026-03-01');

    expect(second.map((quest) => quest.id)).toEqual(first.map((quest) => quest.id));
  });

  it('awards a quest reward exactly once, however often progress is reported', () => {
    const { user } = userRepository.createLocalUser(input);

    gamification.ensureDailyQuests(user.id, '2026-03-01');
    gamification.setQuestProgress(user.id, 'drink_water', 8, '2026-03-01');
    gamification.setQuestProgress(user.id, 'drink_water', 9, '2026-03-01');

    expect(gamification.getCoinBalance(user.id)).toBe(20);
  });
});

describe('resolveTier', () => {
  it('is free with no subscription', () => {
    const { user } = userRepository.createLocalUser(input);

    expect(gamification.resolveTier(user.id)).toBe('free');
  });
});

function targets(kcal: number) {
  return {
    targetKcal: kcal,
    targetCarbsG: 200,
    targetProteinG: 150,
    targetFatG: 60,
    targetWaterMl: 2000,
  };
}
