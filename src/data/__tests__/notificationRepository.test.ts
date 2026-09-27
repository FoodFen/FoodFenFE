// src/data/__tests__/notificationRepository.test.ts
import { waterLog } from '@/db/schema';
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import { shiftDateKey, todayKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';

import * as entryRepository from '../entryRepository';
import * as logRepository from '../logRepository';
import * as notificationRepository from '../notificationRepository';
import { touch } from '../sync';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

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

/**
 * N days before today, as a DateKey. Fixtures are built relative to
 * `todayKey()` (never a hardcoded calendar date) so they stay inside the
 * default 14-day window no matter when this test actually runs.
 */
function daysAgo(n: number): string {
  return shiftDateKey(todayKey(), -n);
}

function logMealAt(
  userId: string,
  mealType: 'breakfast' | 'lunch' | 'dinner',
  dateKey: string,
  hour: number,
  minute: number,
) {
  return entryRepository.createEntry({
    userId,
    name: mealType,
    mealType,
    inputMethod: 'manual',
    loggedOn: dateKey,
    loggedAt: new Date(
      `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    ),
    ingredients: [],
  });
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('medianMealTime', () => {
  it('returns null with fewer than 3 samples', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);

    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toBeNull();
  });

  it('returns the middle value for an odd sample count', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);

    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toEqual({
      hour: 12,
      minute: 30,
    });
  });

  it('averages the two middle values for an even sample count', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(4), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(3), 12, 20);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 40);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);

    // sorted minutes: 720, 740, 760, 780 → middle two average to 750 → 12:30
    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toEqual({
      hour: 12,
      minute: 30,
    });
  });

  it('ignores entries for a different meal type', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);
    logMealAt(user.id, 'breakfast', daysAgo(1), 7, 0);

    expect(notificationRepository.medianMealTime(user.id, 'breakfast')).toBeNull();
  });

  it('ignores entries outside the day window', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);
    logMealAt(user.id, 'lunch', daysAgo(400), 23, 59);

    expect(notificationRepository.medianMealTime(user.id, 'lunch', 14)).toEqual({
      hour: 12,
      minute: 30,
    });
  });

  it('excludes a soft-deleted entry', () => {
    const user = createUser();

    const toDelete = logMealAt(user.id, 'lunch', daysAgo(3), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(2), 12, 30);
    logMealAt(user.id, 'lunch', daysAgo(1), 13, 0);

    entryRepository.deleteEntry(toDelete.id);

    // Only 2 live entries remain — below the 3-sample threshold.
    expect(notificationRepository.medianMealTime(user.id, 'lunch')).toBeNull();
  });
});

describe('medianLastLogTime', () => {
  it('returns null with fewer than 3 distinct days', () => {
    const user = createUser();

    logMealAt(user.id, 'lunch', daysAgo(2), 12, 0);
    logMealAt(user.id, 'lunch', daysAgo(1), 12, 0);

    expect(notificationRepository.medianLastLogTime(user.id)).toBeNull();
  });

  it('takes the latest log of each day across food, activity, and water', () => {
    const user = createUser();
    const day3 = daysAgo(3);
    const day2 = daysAgo(2);
    const day1 = daysAgo(1);

    // 3 days ago: only a lunch at 12:00 → last log 12:00
    logMealAt(user.id, 'lunch', day3, 12, 0);

    // 2 days ago: lunch at 12:00, then an evening activity at 20:00 → last log 20:00
    logMealAt(user.id, 'lunch', day2, 12, 0);
    logRepository.addActivity({
      userId: user.id,
      activityType: 'walk',
      caloriesBurned: 100,
      date: day2,
      loggedAt: new Date(`${day2}T20:00:00`),
    });

    // 1 day ago: lunch at 12:00, then water at 22:00 → last log 22:00
    logMealAt(user.id, 'lunch', day1, 12, 0);
    mockDb
      .insert(waterLog)
      .values({
        id: generateLocalId('water'),
        userId: user.id,
        amountMl: 250,
        loggedAt: new Date(`${day1}T22:00:00`),
        loggedOn: day1,
        remoteId: null,
        deletedAt: null,
        ...touch(),
      })
      .run();

    // Medians of [12:00, 20:00, 22:00] → 20:00
    expect(notificationRepository.medianLastLogTime(user.id)).toEqual({ hour: 20, minute: 0 });
  });
});
