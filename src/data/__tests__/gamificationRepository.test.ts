import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';

import * as gamification from '../gamificationRepository';
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

function createUser() {
  return userRepository.createLocalUser(input).user;
}

beforeEach(() => {
  mockDb = createTestDatabase();
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

describe('setQuestProgress completionRatio', () => {
  it('completes before progress reaches target when the ratio is below 1', () => {
    const user = createUser();

    gamification.ensureDailyQuests(user.id, '2026-03-01', 2000);
    // hit_calorie_goal's completionRatio is 0.9 — 1800/2000 = 0.9, exactly the threshold.
    const updated = gamification.setQuestProgress(
      user.id,
      'hit_calorie_goal',
      1800,
      '2026-03-01',
    );

    expect(updated?.completed).toBe(true);
    expect(gamification.getCoinBalance(user.id)).toBe(50);
  });

  it('does not complete below the ratio', () => {
    const user = createUser();

    gamification.ensureDailyQuests(user.id, '2026-03-01', 2000);
    const updated = gamification.setQuestProgress(
      user.id,
      'hit_calorie_goal',
      1000,
      '2026-03-01',
    );

    expect(updated?.completed).toBe(false);
    expect(gamification.getCoinBalance(user.id)).toBe(0);
  });
});

describe('ensureWeeklyQuests', () => {
  it('issues the weekly set once per week, not once per day', () => {
    const user = createUser();

    // Monday of that week.
    const first = gamification.ensureWeeklyQuests(user.id, '2026-03-02');
    const second = gamification.ensureWeeklyQuests(user.id, '2026-03-02');

    expect(second.map((row) => row.id)).toEqual(first.map((row) => row.id));
  });

  it('does not collide with a daily quest issued on the same date', () => {
    const user = createUser();

    gamification.ensureDailyQuests(user.id, '2026-03-02');
    const weekly = gamification.ensureWeeklyQuests(user.id, '2026-03-02');

    expect(weekly).toHaveLength(1);
    expect(weekly[0]?.questType).toBe('stay_active_week');

    // The daily set is still intact — sharing a questDate did not merge them.
    const daily = gamification.getActiveQuests(user.id, '2026-03-02');
    expect(daily.filter((row) => row.cadence === 'daily')).toHaveLength(3);
  });
});
