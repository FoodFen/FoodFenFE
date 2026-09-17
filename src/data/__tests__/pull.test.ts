import { eq } from 'drizzle-orm';

import { syncApi } from '@/api/endpoints/sync';
import type {
  RemoteActivityLog,
  RemoteDailyGoal,
  RemoteFoodEntry,
  RemoteWaterLog,
} from '@/api/schemas';
import { db } from '@/db/client';
import { activityLog, dailyGoal, foodEntry, ingredient, waterLog } from '@/db/schema';
import type { TestDatabase } from '@/db/testDatabase';
import { createTestDatabase } from '@/db/testDatabase';

import { pullDailyGoals, pullDayLogs, pullFoodEntries, pulledRowCount } from '../pull';
import { markSynced } from '../sync';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

jest.mock('@/db/client', () => ({
  get db() {
    return mockDb;
  },
}));

jest.mock('@/api/endpoints/sync', () => ({
  syncApi: {
    goals: jest.fn(),
    foodEntries: jest.fn(),
    activityLogs: jest.fn(),
    waterLogs: jest.fn(),
    weightLogs: jest.fn(),
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

function remoteGoal(overrides: Partial<RemoteDailyGoal>): RemoteDailyGoal {
  return {
    id: 501,
    userId: 1,
    targetKcal: 2200,
    targetCarbsG: 250,
    targetProteinG: 150,
    targetFatG: 70,
    targetWaterMl: 2500,
    effectiveDate: '2026-03-10',
    ...overrides,
  };
}

beforeEach(() => {
  mockDb = createTestDatabase();
  jest.clearAllMocks();
});

describe('pullDailyGoals', () => {
  it('inserts a remote goal the device has not seen', async () => {
    mockedSyncApi.goals.mockResolvedValue([remoteGoal({})]);
    const user = createUser();

    await pullDailyGoals(user.id);

    const goal = userRepository.getGoalForDate(user.id, '2026-03-10');

    expect(goal?.targetKcal).toBe(2200);
    expect(goal?.remoteId).toBe(501);
  });

  it('never overwrites a locally modified row with the same remote id', async () => {
    const user = createUser();
    const local = userRepository.setGoal(
      user.id,
      { targetKcal: 1800, targetCarbsG: 200, targetProteinG: 120, targetFatG: 60, targetWaterMl: 2000 },
      '2026-03-10',
    );

    // Attach a remote id without marking synced: the row is still dirty.
    db.update(dailyGoal).set({ remoteId: 501 }).where(eq(dailyGoal.id, local.id)).run();

    mockedSyncApi.goals.mockResolvedValue([remoteGoal({ targetKcal: 9999 })]);

    await pullDailyGoals(user.id);

    const goal = userRepository.getGoalForDate(user.id, '2026-03-10');

    expect(goal?.targetKcal).toBe(1800);
  });

  it('updates a synced local row once the server has newer data', async () => {
    const user = createUser();
    const local = userRepository.setGoal(
      user.id,
      { targetKcal: 1800, targetCarbsG: 200, targetProteinG: 120, targetFatG: 60, targetWaterMl: 2000 },
      '2026-03-10',
    );

    markSynced(dailyGoal, local.id, 501);

    mockedSyncApi.goals.mockResolvedValue([remoteGoal({ targetKcal: 2500 })]);

    await pullDailyGoals(user.id);

    const goal = userRepository.getGoalForDate(user.id, '2026-03-10');

    expect(goal?.targetKcal).toBe(2500);
  });
});

describe('pullFoodEntries', () => {
  function remoteEntry(overrides: Partial<RemoteFoodEntry>): RemoteFoodEntry {
    return {
      id: 900,
      userId: 1,
      name: 'Server Salad',
      inputMethod: 'type',
      imageUrl: null,
      totalKcal: 400,
      carbsG: 30,
      proteinG: 20,
      fatG: 15,
      fiberG: 5,
      aiFeedback: null,
      mealType: 'lunch',
      loggedAt: '2026-03-10T12:00:00.000Z',
      loggedOn: '2026-03-10',
      ingredients: [
        {
          id: 1,
          foodEntryId: 900,
          name: 'Lettuce',
          quantityG: 100,
          kcal: 20,
          carbsG: 4,
          proteinG: 1,
          fatG: 0,
          fiberG: 2,
        },
      ],
      ...overrides,
    };
  }

  it('inserts a new remote entry along with its ingredients', async () => {
    const user = createUser();
    mockedSyncApi.foodEntries.mockResolvedValue([remoteEntry({})]);

    await pullFoodEntries(user.id, '2026-03-10', '2026-03-10');

    const entries = db.select().from(foodEntry).where(eq(foodEntry.userId, user.id)).all();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe('Server Salad');
    expect(entries[0]?.remoteId).toBe(900);

    const ingredients = db
      .select()
      .from(ingredient)
      .where(eq(ingredient.foodEntryId, entries[0]!.id))
      .all();
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.name).toBe('Lettuce');
  });

  it('does not overwrite a dirty local entry with the same remote id', async () => {
    const user = createUser();
    mockedSyncApi.foodEntries.mockResolvedValue([remoteEntry({})]);
    await pullFoodEntries(user.id, '2026-03-10', '2026-03-10');

    const [existing] = db.select().from(foodEntry).where(eq(foodEntry.userId, user.id)).all();
    // Simulate a local edit made after the first pull: dirty again.
    db.update(foodEntry)
      .set({ name: 'User Edited Name', updatedAt: new Date(), syncedAt: null })
      .where(eq(foodEntry.id, existing!.id))
      .run();

    mockedSyncApi.foodEntries.mockResolvedValue([remoteEntry({ name: 'Server Renamed It' })]);
    await pullFoodEntries(user.id, '2026-03-10', '2026-03-10');

    const [after] = db.select().from(foodEntry).where(eq(foodEntry.userId, user.id)).all();
    expect(after?.name).toBe('User Edited Name');
  });
});

describe('pullDayLogs', () => {
  function remoteWater(): RemoteWaterLog {
    return {
      id: 1,
      userId: 1,
      amountMl: 250,
      loggedAt: '2026-03-10T08:00:00.000Z',
      loggedOn: '2026-03-10',
    };
  }

  function remoteActivity(): RemoteActivityLog {
    return {
      id: 1,
      userId: 1,
      activityType: 'walking',
      caloriesBurned: 150,
      source: 'manual',
      loggedAt: '2026-03-10T08:00:00.000Z',
      loggedOn: '2026-03-10',
    };
  }

  it('pulls water, activity and weight logs into the local tables', async () => {
    const user = createUser();
    mockedSyncApi.waterLogs.mockResolvedValue([remoteWater()]);
    mockedSyncApi.activityLogs.mockResolvedValue([remoteActivity()]);
    mockedSyncApi.weightLogs.mockResolvedValue([]);

    await pullDayLogs(user.id, '2026-03-10', '2026-03-10');

    expect(mockedSyncApi.waterLogs).toHaveBeenCalledWith('2026-03-10', '2026-03-10');
    expect(mockedSyncApi.activityLogs).toHaveBeenCalledWith('2026-03-10', '2026-03-10');
    expect(mockedSyncApi.weightLogs).toHaveBeenCalledWith('2026-03-10', '2026-03-10');

    const water = db.select().from(waterLog).where(eq(waterLog.userId, user.id)).all();
    const activity = db.select().from(activityLog).where(eq(activityLog.userId, user.id)).all();

    expect(water).toHaveLength(1);
    expect(water[0]?.amountMl).toBe(250);
    expect(activity).toHaveLength(1);
    expect(activity[0]?.caloriesBurned).toBe(150);
  });
});

describe('pulledRowCount', () => {
  it('counts only food entries that carry a remote id', async () => {
    const user = createUser();
    expect(pulledRowCount()).toBe(0);

    mockedSyncApi.foodEntries.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        name: 'Server Meal',
        inputMethod: 'type',
        imageUrl: null,
        totalKcal: 300,
        carbsG: 20,
        proteinG: 10,
        fatG: 10,
        fiberG: null,
        aiFeedback: null,
        mealType: 'dinner',
        loggedAt: '2026-03-10T19:00:00.000Z',
        loggedOn: '2026-03-10',
        ingredients: [],
      },
    ]);

    await pullFoodEntries(user.id, '2026-03-10', '2026-03-10');

    expect(pulledRowCount()).toBe(1);
  });
});
