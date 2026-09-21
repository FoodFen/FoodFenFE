import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';

import * as logRepository from '../logRepository';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

function createUser() {
  return userRepository.createLocalUser({
    gender: 'female',
    birthYear: 1995,
    height: 165,
    weightCurrent: 65,
    weightGoal: 65,
    activityLevel: 'moderate',
    dietType: 'balanced',
    weeklyRateKg: 0,
  }).user;
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('upsertHealthSteps', () => {
  it('inserts a new steps row with the right source and activityType', () => {
    const user = createUser();

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityType: 'steps',
      source: 'google_fit',
      caloriesBurned: 120,
    });
  });

  it('updates the same row in place on a second sync for the same day', () => {
    const user = createUser();

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');
    logRepository.upsertHealthSteps(user.id, '2026-03-01', 260, 'google_fit');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(1);
    expect(activities[0]?.caloriesBurned).toBe(260);
  });

  it('never touches a manually-logged row for the same day', () => {
    const user = createUser();

    logRepository.addActivity({
      userId: user.id,
      activityType: 'walking',
      caloriesBurned: 141,
      date: '2026-03-01',
    });

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(2);
    expect(activities.find((a) => a.source === 'manual')?.caloriesBurned).toBe(141);
    expect(activities.find((a) => a.source === 'google_fit')?.caloriesBurned).toBe(120);
  });

  it('keeps apple_health and google_fit as separate rows if both ever write the same day', () => {
    const user = createUser();

    logRepository.upsertHealthSteps(user.id, '2026-03-01', 120, 'google_fit');
    logRepository.upsertHealthSteps(user.id, '2026-03-01', 130, 'apple_health');

    const activities = logRepository.getActivities(user.id, '2026-03-01');

    expect(activities).toHaveLength(2);
  });
});
