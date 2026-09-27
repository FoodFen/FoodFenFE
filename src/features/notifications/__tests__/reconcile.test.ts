// src/features/notifications/__tests__/reconcile.test.ts
import * as entryRepository from '@/data/entryRepository';
import * as gamification from '@/data/gamificationRepository';
import * as userRepository from '@/data/userRepository';
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import { useSettingsStore } from '@/features/settings/store';
import { shiftDateKey, todayKey } from '@/lib/date';
import * as scheduler from '@/lib/notificationScheduler';

import { reconcileNotifications } from '../reconcile';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

jest.mock('@/lib/notificationScheduler', () => {
  const actual = jest.requireActual('@/lib/notificationScheduler');

  return {
    ...actual,
    scheduleAt: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
  };
});

const mockedScheduler = jest.mocked(scheduler);

function createUser() {
  return userRepository.createLocalUser({
    gender: 'male',
    birthYear: 1990,
    height: 180,
    weightCurrent: 80,
    weightGoal: 75,
    activityLevel: 'moderate',
    dietType: 'balanced',
    weeklyRateKg: 0.5,
  }).user;
}

beforeEach(() => {
  mockDb = createTestDatabase();
  jest.clearAllMocks();
  useSettingsStore.setState({ mealRemindersEnabled: true, streakRemindersEnabled: true });
});

describe('reconcileNotifications — meal reminders', () => {
  it('cancels a meal reminder when that meal is already logged today', async () => {
    const user = createUser();

    entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: todayKey(),
      ingredients: [],
    });

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-lunch');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'meal-lunch',
      expect.anything(),
      expect.anything(),
    );
  });

  it('schedules a meal reminder at the fixed default time when there is no history yet', async () => {
    const user = createUser();

    await reconcileNotifications(user.id);

    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'meal-breakfast',
      expect.any(Date),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );

    const [, scheduledAt] = mockedScheduler.scheduleAt.mock.calls.find(
      (call) => call[0] === 'meal-breakfast',
    ) as Parameters<typeof mockedScheduler.scheduleAt>;

    expect(scheduledAt.getHours()).toBe(mockedScheduler.DEFAULT_MEAL_TIMES.breakfast.hour);
    expect(scheduledAt.getMinutes()).toBe(mockedScheduler.DEFAULT_MEAL_TIMES.breakfast.minute);
  });

  it('cancels all three meal reminders when mealRemindersEnabled is off', async () => {
    const user = createUser();

    useSettingsStore.setState({ mealRemindersEnabled: false });

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-breakfast');
    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-lunch');
    expect(mockedScheduler.cancel).toHaveBeenCalledWith('meal-dinner');
  });
});

describe('reconcileNotifications — streak-at-risk', () => {
  it('cancels streak-risk when today is already the last active day', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, todayKey());

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
  });

  it('schedules streak-risk when the streak is active but today is unlogged', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, shiftDateKey(todayKey(), -1));

    await reconcileNotifications(user.id);

    expect(mockedScheduler.scheduleAt).toHaveBeenCalledWith(
      'streak-risk',
      expect.any(Date),
      expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
    );
  });

  it('does not schedule streak-risk for a user with no streak row yet', async () => {
    const user = createUser();

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });

  it('cancels streak-risk when streakRemindersEnabled is off', async () => {
    const user = createUser();

    gamification.recordActiveDay(user.id, shiftDateKey(todayKey(), -1));
    useSettingsStore.setState({ streakRemindersEnabled: false });

    await reconcileNotifications(user.id);

    expect(mockedScheduler.cancel).toHaveBeenCalledWith('streak-risk');
    expect(mockedScheduler.scheduleAt).not.toHaveBeenCalledWith(
      'streak-risk',
      expect.anything(),
      expect.anything(),
    );
  });
});
