import { eq } from 'drizzle-orm';

import { syncApi } from '@/api/endpoints/sync';
import type { RemoteFoodEntry } from '@/api/schemas';
import { db } from '@/db/client';
import { activityLog, foodEntry, ingredient, streak, user, waterLog, weightLog } from '@/db/schema';
import type { TestDatabase } from '@/db/testDatabase';
import { createTestDatabase } from '@/db/testDatabase';

import * as entryRepository from '../entryRepository';
import * as gamification from '../gamificationRepository';
import * as logRepository from '../logRepository';
import {
  pushDailyGoals,
  pushDayLogs,
  pushFoodEntries,
  pushStreak,
  pushUserProfile,
} from '../push';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

jest.mock('@/api/endpoints/sync', () => ({
  syncApi: {
    pushUser: jest.fn(),
    pushGoal: jest.fn(),
    pushStreak: jest.fn(),
    createFoodEntry: jest.fn(),
    updateFoodEntry: jest.fn(),
    deleteFoodEntry: jest.fn(),
    createActivityLog: jest.fn(),
    updateActivityLog: jest.fn(),
    createWeightLog: jest.fn(),
    createWaterLog: jest.fn(),
    updateWaterLog: jest.fn(),
    deleteWaterLog: jest.fn(),
  },
}));

const mockedSyncApi = jest.mocked(syncApi);

const profileInput = {
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
  return userRepository.createLocalUser(profileInput).user;
}

beforeEach(() => {
  mockDb = createTestDatabase();
  jest.clearAllMocks();
});

describe('pushUserProfile', () => {
  it('pushes a dirty profile and marks it synced', async () => {
    const localUser = createUser();
    mockedSyncApi.pushUser.mockResolvedValue({
      id: 1,
      email: 'fe-test@example.com',
      displayName: null,
      gender: 'male',
      birthYear: 1990,
      unitSystem: 'metric',
      height: 180,
      weightCurrent: 85,
      weightGoal: 78,
      activityLevel: 'moderate',
      dietType: 'balanced',
      calorieCalcMode: 'auto',
      calorieLeftMode: 'all_calories',
      subscriptionTier: 'free',
      weeklyRateKg: 0.5,
      createdAt: new Date().toISOString(),
    });

    await pushUserProfile(localUser);

    expect(mockedSyncApi.pushUser).toHaveBeenCalledWith(
      expect.objectContaining({ height: 180, weightGoal: 78 }),
    );

    const [row] = db.select().from(user).where(eq(user.id, localUser.id)).all();
    expect(row?.syncedAt).not.toBeNull();
  });

  it('leaves the row dirty when the request fails', async () => {
    const localUser = createUser();
    mockedSyncApi.pushUser.mockRejectedValue(new Error('network down'));

    await pushUserProfile(localUser);

    const [row] = db.select().from(user).where(eq(user.id, localUser.id)).all();
    expect(row?.syncedAt).toBeNull();
  });
});

describe('pushDailyGoals', () => {
  it('pushes a dirty goal and stores the server id', async () => {
    const localUser = createUser();
    mockedSyncApi.pushGoal.mockResolvedValue({
      id: 'goal_remote_1',
      userId: 1,
      targetKcal: 2200,
      targetCarbsG: 250,
      targetProteinG: 150,
      targetFatG: 70,
      targetWaterMl: 2000,
      effectiveDate: '2026-03-10',
    });

    userRepository.setGoal(
      localUser.id,
      { targetKcal: 2200, targetCarbsG: 250, targetProteinG: 150, targetFatG: 70, targetWaterMl: 2000 },
      '2026-03-10',
    );

    await pushDailyGoals(localUser.id);

    expect(mockedSyncApi.pushGoal).toHaveBeenCalledWith(
      expect.objectContaining({ targetKcal: 2200, effectiveDate: '2026-03-10' }),
    );

    const goal = userRepository.getGoalForDate(localUser.id, '2026-03-10');
    expect(goal?.remoteId).toBe('goal_remote_1');
  });
});

describe('pushStreak', () => {
  it('pushes the account streak row and stores the server id', async () => {
    const localUser = createUser();
    mockedSyncApi.pushStreak.mockResolvedValue({
      id: 'streak_remote_1',
      userId: 1,
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: '2026-03-10',
    });

    gamification.recordActiveDay(localUser.id, '2026-03-08');
    gamification.recordActiveDay(localUser.id, '2026-03-09');
    gamification.recordActiveDay(localUser.id, '2026-03-10');

    await pushStreak(localUser.id);

    expect(mockedSyncApi.pushStreak).toHaveBeenCalledWith(
      expect.objectContaining({ currentStreak: 3, lastActiveDate: '2026-03-10' }),
    );

    const [row] = db.select().from(streak).where(eq(streak.userId, localUser.id)).all();
    expect(row?.remoteId).toBe('streak_remote_1');
    expect(row?.syncedAt).not.toBeNull();
  });

  it('does nothing when there is no streak row yet', async () => {
    const localUser = createUser();

    await pushStreak(localUser.id);

    expect(mockedSyncApi.pushStreak).not.toHaveBeenCalled();
  });

  it('leaves the row dirty when the request fails', async () => {
    const localUser = createUser();
    mockedSyncApi.pushStreak.mockRejectedValue(new Error('network down'));

    gamification.recordActiveDay(localUser.id, '2026-03-10');

    await pushStreak(localUser.id);

    const [row] = db.select().from(streak).where(eq(streak.userId, localUser.id)).all();
    expect(row?.syncedAt).toBeNull();
  });
});

describe('pushFoodEntries', () => {
  function remoteEntry(overrides: Partial<RemoteFoodEntry> = {}): RemoteFoodEntry {
    return {
      id: 'entry_remote_1',
      userId: 1,
      name: 'Grilled chicken',
      inputMethod: 'manual' as const,
      imageUrl: null,
      totalKcal: 330,
      carbsG: 0,
      proteinG: 40,
      fatG: 15,
      fiberG: null,
      aiFeedback: null,
      mealType: 'lunch' as const,
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
      ingredients: [
        {
          id: 'ing_remote_1',
          foodEntryId: 'entry_remote_1',
          name: 'Chicken breast',
          quantityG: 200,
          kcal: 330,
          carbsG: 0,
          proteinG: 40,
          fatG: 15,
          fiberG: null,
        },
      ],
      ...overrides,
    };
  }

  it('creates a new entry server-side and syncs the entry and its ingredients', async () => {
    const localUser = createUser();
    mockedSyncApi.createFoodEntry.mockResolvedValue(remoteEntry());

    const entry = entryRepository.createEntry({
      userId: localUser.id,
      name: 'Grilled chicken',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: '2026-03-10',
      ingredients: [
        { name: 'Chicken breast', quantityG: 200, kcal: 330, carbsG: 0, proteinG: 40, fatG: 15 },
      ],
    });

    await pushFoodEntries(localUser.id);

    expect(mockedSyncApi.createFoodEntry).toHaveBeenCalledTimes(1);
    expect(mockedSyncApi.updateFoodEntry).not.toHaveBeenCalled();

    const [entryRow] = db.select().from(foodEntry).where(eq(foodEntry.id, entry.id)).all();
    expect(entryRow?.remoteId).toBe('entry_remote_1');
    expect(entryRow?.syncedAt).not.toBeNull();

    const ingredientRows = db.select().from(ingredient).where(eq(ingredient.foodEntryId, entry.id)).all();
    expect(ingredientRows.every((row) => row.syncedAt !== null)).toBe(true);
  });

  it('updates an already-synced entry and excludes stale soft-deleted ingredients from the request', async () => {
    const localUser = createUser();
    mockedSyncApi.createFoodEntry.mockResolvedValue(remoteEntry());

    const entry = entryRepository.createEntry({
      userId: localUser.id,
      name: 'Grilled chicken',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: '2026-03-10',
      ingredients: [
        { name: 'Chicken breast', quantityG: 200, kcal: 330, carbsG: 0, proteinG: 40, fatG: 15 },
      ],
    });

    await pushFoodEntries(localUser.id); // first push: creates, gets a remote id

    // Editing replaces the ingredient list: `updateEntry` soft-deletes the old
    // row and inserts a new one, which is exactly the case this test targets.
    entryRepository.updateEntry(entry.id, {
      ingredients: [
        { name: 'Chicken thigh', quantityG: 150, kcal: 280, carbsG: 0, proteinG: 30, fatG: 18 },
      ],
    });

    mockedSyncApi.updateFoodEntry.mockResolvedValue(
      remoteEntry({
        name: 'Grilled chicken',
        ingredients: [
          {
            id: 'ing_remote_2',
            foodEntryId: 'entry_remote_1',
            name: 'Chicken thigh',
            quantityG: 150,
            kcal: 280,
            carbsG: 0,
            proteinG: 30,
            fatG: 18,
            fiberG: null,
          },
        ],
      }),
    );

    await pushFoodEntries(localUser.id); // second push: updates by remote id

    expect(mockedSyncApi.updateFoodEntry).toHaveBeenCalledWith(
      'entry_remote_1',
      expect.objectContaining({
        ingredients: [expect.objectContaining({ name: 'Chicken thigh' })],
      }),
    );

    // Every ingredient row for this entry — live and the stale soft-deleted
    // one from before the edit — must end up synced, or pendingChangeCount()
    // would count the stale row forever.
    const allIngredientRows = db.select().from(ingredient).where(eq(ingredient.foodEntryId, entry.id)).all();
    expect(allIngredientRows.length).toBe(2);
    expect(allIngredientRows.every((row) => row.syncedAt !== null)).toBe(true);
  });

  it('deletes server-side when a synced entry is removed locally, and syncs its ingredients too', async () => {
    const localUser = createUser();
    mockedSyncApi.createFoodEntry.mockResolvedValue(remoteEntry());

    const entry = entryRepository.createEntry({
      userId: localUser.id,
      name: 'Grilled chicken',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: '2026-03-10',
      ingredients: [
        { name: 'Chicken breast', quantityG: 200, kcal: 330, carbsG: 0, proteinG: 40, fatG: 15 },
      ],
    });

    await pushFoodEntries(localUser.id); // synced, has a remote id

    entryRepository.deleteEntry(entry.id);
    mockedSyncApi.deleteFoodEntry.mockResolvedValue(undefined);

    await pushFoodEntries(localUser.id);

    expect(mockedSyncApi.deleteFoodEntry).toHaveBeenCalledWith('entry_remote_1');

    const [entryRow] = db.select().from(foodEntry).where(eq(foodEntry.id, entry.id)).all();
    expect(entryRow?.syncedAt).not.toBeNull();

    const ingredientRows = db.select().from(ingredient).where(eq(ingredient.foodEntryId, entry.id)).all();
    expect(ingredientRows.every((row) => row.syncedAt !== null)).toBe(true);
  });

  it('never calls the server for an entry created and deleted before it ever synced', async () => {
    const localUser = createUser();

    const entry = entryRepository.createEntry({
      userId: localUser.id,
      name: 'Grilled chicken',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: '2026-03-10',
      ingredients: [],
    });

    entryRepository.deleteEntry(entry.id);

    await pushFoodEntries(localUser.id);

    expect(mockedSyncApi.createFoodEntry).not.toHaveBeenCalled();
    expect(mockedSyncApi.deleteFoodEntry).not.toHaveBeenCalled();

    const [entryRow] = db.select().from(foodEntry).where(eq(foodEntry.id, entry.id)).all();
    expect(entryRow?.syncedAt).not.toBeNull();
  });

  it('leaves a failed row dirty and keeps going rather than throwing', async () => {
    const localUser = createUser();
    mockedSyncApi.createFoodEntry.mockRejectedValue(new Error('server error'));

    const entry = entryRepository.createEntry({
      userId: localUser.id,
      name: 'Grilled chicken',
      mealType: 'lunch',
      inputMethod: 'manual',
      loggedOn: '2026-03-10',
      ingredients: [],
    });

    await expect(pushFoodEntries(localUser.id)).resolves.toBeUndefined();

    const [entryRow] = db.select().from(foodEntry).where(eq(foodEntry.id, entry.id)).all();
    expect(entryRow?.remoteId).toBeNull();
    expect(entryRow?.syncedAt).toBeNull();
  });
});

describe('pushDayLogs', () => {
  it('creates activity, water and weight logs and stores their server ids', async () => {
    const localUser = createUser();

    mockedSyncApi.createActivityLog.mockResolvedValue({
      id: 'act_remote_1',
      userId: 1,
      activityType: 'walking',
      caloriesBurned: 150,
      source: 'manual',
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
    });
    mockedSyncApi.createWaterLog.mockResolvedValue({
      id: 'water_remote_1',
      userId: 1,
      amountMl: 250,
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
    });
    mockedSyncApi.createWeightLog.mockResolvedValue({
      id: 'weight_remote_1',
      userId: 1,
      weight: 80,
      recordedAt: '2026-03-10',
    });

    logRepository.addActivity({
      userId: localUser.id,
      activityType: 'walking',
      caloriesBurned: 150,
      date: '2026-03-10',
    });
    logRepository.addWater(localUser.id, 250, '2026-03-10');
    logRepository.logWeight(localUser.id, 80, '2026-03-10');

    await pushDayLogs(localUser.id);

    const [activityRow] = db.select().from(activityLog).where(eq(activityLog.userId, localUser.id)).all();
    const [waterRow] = db.select().from(waterLog).where(eq(waterLog.userId, localUser.id)).all();
    const [weightRow] = db.select().from(weightLog).where(eq(weightLog.userId, localUser.id)).all();

    expect(activityRow?.remoteId).toBe('act_remote_1');
    expect(waterRow?.remoteId).toBe('water_remote_1');
    expect(weightRow?.remoteId).toBe('weight_remote_1');
  });

  it('deletes a synced water log removed by "undo last cup"', async () => {
    const localUser = createUser();
    mockedSyncApi.createWaterLog.mockResolvedValue({
      id: 'water_remote_1',
      userId: 1,
      amountMl: 250,
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
    });

    logRepository.addWater(localUser.id, 250, '2026-03-10');
    await pushDayLogs(localUser.id); // synced, has a remote id

    logRepository.removeLastWater(localUser.id, '2026-03-10');
    mockedSyncApi.deleteWaterLog.mockResolvedValue(undefined);

    await pushDayLogs(localUser.id);

    expect(mockedSyncApi.deleteWaterLog).toHaveBeenCalledWith('water_remote_1');

    const [waterRow] = db.select().from(waterLog).where(eq(waterLog.userId, localUser.id)).all();
    expect(waterRow?.syncedAt).not.toBeNull();
  });

  it('PATCHes an already-synced row shrunk in place, with no clientId in the body', async () => {
    const localUser = createUser();
    mockedSyncApi.createWaterLog.mockResolvedValue({
      id: 'water_remote_1',
      userId: 1,
      amountMl: 500,
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
    });

    logRepository.addWater(localUser.id, 500, '2026-03-10');
    await pushDayLogs(localUser.id); // synced, has a remote id

    // Shrinks the already-synced row's amount in place rather than deleting
    // it outright — the "tap a cup down" case.
    logRepository.setWaterTotal(localUser.id, '2026-03-10', 250);

    mockedSyncApi.updateWaterLog.mockResolvedValue({
      id: 'water_remote_1',
      userId: 1,
      amountMl: 250,
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
    });

    await pushDayLogs(localUser.id);

    expect(mockedSyncApi.createWaterLog).toHaveBeenCalledTimes(1);
    expect(mockedSyncApi.updateWaterLog).toHaveBeenCalledWith(
      'water_remote_1',
      expect.objectContaining({ amountMl: 250 }),
    );
    // The :id in the URL already identifies the row — no clientId belongs
    // in a PATCH body, same convention as every other update endpoint.
    expect(mockedSyncApi.updateWaterLog.mock.calls[0]?.[1]).not.toHaveProperty('clientId');

    const [waterRow] = db.select().from(waterLog).where(eq(waterLog.userId, localUser.id)).all();
    expect(waterRow?.remoteId).toBe('water_remote_1');
    expect(waterRow?.syncedAt).not.toBeNull();
  });

  it('updates an already-synced activity log corrected in place (health steps)', async () => {
    const localUser = createUser();
    mockedSyncApi.createActivityLog.mockResolvedValue({
      id: 'act_remote_1',
      userId: 1,
      activityType: 'steps',
      caloriesBurned: 100,
      source: 'apple_health',
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
    });

    logRepository.upsertHealthSteps(localUser.id, '2026-03-10', 100, 'apple_health');
    await pushDayLogs(localUser.id); // synced

    logRepository.upsertHealthSteps(localUser.id, '2026-03-10', 180, 'apple_health');

    mockedSyncApi.updateActivityLog.mockResolvedValue({
      id: 'act_remote_1',
      userId: 1,
      activityType: 'steps',
      caloriesBurned: 180,
      source: 'apple_health',
      loggedAt: new Date().toISOString(),
      loggedOn: '2026-03-10',
    });

    await pushDayLogs(localUser.id);

    expect(mockedSyncApi.updateActivityLog).toHaveBeenCalledWith(
      'act_remote_1',
      expect.objectContaining({ caloriesBurned: 180 }),
    );

    const [activityRow] = db.select().from(activityLog).where(eq(activityLog.userId, localUser.id)).all();
    expect(activityRow?.syncedAt).not.toBeNull();
  });
});
