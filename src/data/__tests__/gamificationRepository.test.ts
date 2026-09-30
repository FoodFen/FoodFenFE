import { gamificationApi } from '@/api/endpoints/gamification';
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import { shiftDateKey, todayKey } from '@/lib/date';

import * as gamification from '../gamificationRepository';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

jest.mock('@/api/endpoints/gamification', () => ({
  gamificationApi: {
    quests: jest.fn(),
    redeemCoins: jest.fn(),
  },
}));

const mockedGamificationApi = jest.mocked(gamificationApi);

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

function createUser() {
  return userRepository.createLocalUser(input).user;
}

beforeEach(() => {
  mockDb = createTestDatabase();
  jest.clearAllMocks();
});

describe('recordActiveDay (UC-24b)', () => {
  it('extends the streak on consecutive days', () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, '2026-03-01');
    gamification.recordActiveDay(user.id, '2026-03-02');
    const streak = gamification.recordActiveDay(user.id, '2026-03-03');

    expect(streak.currentStreak).toBe(3);
    expect(streak.longestStreak).toBe(3);
  });

  it('resets to 1 after a missed day, without losing the longest streak', () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, '2026-03-01');
    gamification.recordActiveDay(user.id, '2026-03-02');
    gamification.recordActiveDay(user.id, '2026-03-03'); // streak of 3

    const afterGap = gamification.recordActiveDay(user.id, '2026-03-05'); // skipped 03-04

    expect(afterGap.currentStreak).toBe(1);
    expect(afterGap.longestStreak).toBe(3);
  });

  it('does not double-count a second log the same day', () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, '2026-03-01');
    const again = gamification.recordActiveDay(user.id, '2026-03-01');

    expect(again.currentStreak).toBe(1);
  });
});

describe('pullQuests', () => {
  it('caches the server rows and reconciles the coin balance', async () => {
    const user = createUser();
    const today = todayKey();

    mockedGamificationApi.quests.mockResolvedValue({
      balance: 20,
      quests: [
        {
          id: 'remote_quest_1',
          questType: 'log_all_meals',
          cadence: 'daily',
          questDate: today,
          progress: 3,
          target: 3,
          rewardCoins: 20,
          completed: true,
        },
      ],
    });

    const quests = await gamification.pullQuests(user.id, today);

    expect(mockedGamificationApi.quests).toHaveBeenCalledWith(today);
    expect(quests).toHaveLength(1);
    expect(quests[0]?.completed).toBe(true);
    expect(gamification.getCoinBalance(user.id)).toBe(20);
  });

  it('updates an already-cached quest in place on a later pull, by remote id', async () => {
    const user = createUser();
    const today = todayKey();

    mockedGamificationApi.quests.mockResolvedValue({
      balance: 0,
      quests: [
        {
          id: 'remote_quest_1',
          questType: 'drink_water',
          cadence: 'daily',
          questDate: today,
          progress: 2,
          target: 8,
          rewardCoins: 10,
          completed: false,
        },
      ],
    });
    await gamification.pullQuests(user.id, today);

    mockedGamificationApi.quests.mockResolvedValue({
      balance: 10,
      quests: [
        {
          id: 'remote_quest_1',
          questType: 'drink_water',
          cadence: 'daily',
          questDate: today,
          progress: 8,
          target: 8,
          rewardCoins: 10,
          completed: true,
        },
      ],
    });
    const quests = await gamification.pullQuests(user.id, today);

    // Still one row — the second pull updated it in place rather than inserting a duplicate.
    expect(quests).toHaveLength(1);
    expect(quests[0]?.progress).toBe(8);
    expect(gamification.getCoinBalance(user.id)).toBe(10);
  });
});

describe('redeemCoinsForPremium', () => {
  const remoteSubscription = (endDate: string) => ({
    planType: 'coin_redeem' as const,
    status: 'active' as const,
    startDate: todayKey(),
    endDate,
    price: 0,
  });

  it('writes the balance and subscription the server returns', async () => {
    const user = createUser();
    mockedGamificationApi.redeemCoins.mockResolvedValue({
      balance: 0,
      subscription: remoteSubscription(shiftDateKey(todayKey(), 10)),
    });

    await gamification.redeemCoinsForPremium(user.id, '10day');

    expect(mockedGamificationApi.redeemCoins).toHaveBeenCalledWith(10);
    expect(gamification.getCoinBalance(user.id)).toBe(0);
    const sub = gamification.getSubscription(user.id);
    expect(sub?.planType).toBe('coin_redeem');
    expect(sub?.endDate).toBe(shiftDateKey(todayKey(), 10));
  });

  it('reconciles to the server balance rather than computing a local spend', async () => {
    const user = createUser();
    gamification.addCoins(user.id, 1000, 'adjustment'); // stale local balance

    mockedGamificationApi.redeemCoins.mockResolvedValue({
      balance: 400,
      subscription: remoteSubscription(shiftDateKey(todayKey(), 10)),
    });

    await gamification.redeemCoinsForPremium(user.id, '10day');

    expect(gamification.getCoinBalance(user.id)).toBe(400);
  });

  it('writes nothing locally when the server rejects the redemption', async () => {
    const user = createUser();
    gamification.addCoins(user.id, 100, 'adjustment');
    mockedGamificationApi.redeemCoins.mockRejectedValue(new Error('insufficient coins'));

    await expect(gamification.redeemCoinsForPremium(user.id, '10day')).rejects.toThrow();

    expect(gamification.getCoinBalance(user.id)).toBe(100);
    expect(gamification.getSubscription(user.id)).toBeUndefined();
  });

  it('rejects an unknown bundle id without calling the server', async () => {
    const user = createUser();

    await expect(gamification.redeemCoinsForPremium(user.id, 'nope')).rejects.toThrow();
    expect(mockedGamificationApi.redeemCoins).not.toHaveBeenCalled();
  });
});
