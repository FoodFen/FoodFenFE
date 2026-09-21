import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';
import type { MealType } from '@/types/models';

import * as diaryRepository from '../diaryRepository';
import * as entryRepository from '../entryRepository';
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

function logMeal(
  userId: string,
  date: string,
  kcal: number,
  mealType: MealType = 'lunch',
) {
  return entryRepository.createEntry({
    userId,
    name: 'Meal',
    mealType,
    inputMethod: 'type',
    loggedOn: date,
    ingredients: [
      { name: 'Food', quantityG: 100, kcal, proteinG: 10, carbsG: 20, fatG: 5 },
    ],
  });
}

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('getDiaryDay', () => {
  it('sums the day from its entries', () => {
    const user = createUser();

    logMeal(user.id, '2026-03-01', 400, 'breakfast');
    logMeal(user.id, '2026-03-01', 600, 'lunch');

    const day = diaryRepository.getDiaryDay(user.id, '2026-03-01');

    expect(day.totals.kcal).toBe(1000);
    expect(day.entries).toHaveLength(2);
  });

  it('includes water and exercise from their own logs', () => {
    const user = createUser();

    logRepository.addWater(user.id, 250, '2026-03-01');
    logRepository.addWater(user.id, 500, '2026-03-01');
    logRepository.addActivity({
      userId: user.id,
      activityType: 'Running',
      caloriesBurned: 320,
      date: '2026-03-01',
    });

    const day = diaryRepository.getDiaryDay(user.id, '2026-03-01');

    expect(day.waterMl).toBe(750);
    expect(day.exerciseKcal).toBe(320);
  });

  it('excludes ambient steps from the add-back-eligible exercise total, but not from the displayed total', () => {
    const user = createUser();

    // A deliberate workout — eligible to add back to the eating budget.
    logRepository.addActivity({
      userId: user.id,
      activityType: 'running',
      caloriesBurned: 320,
      date: '2026-03-01',
    });
    // Ambient movement synced from a health app — the TDEE activity-level
    // multiplier already assumes this, so it must not also add back.
    logRepository.upsertHealthSteps(user.id, '2026-03-01', 150, 'google_fit');

    const day = diaryRepository.getDiaryDay(user.id, '2026-03-01');

    expect(day.exerciseKcal).toBe(470);
    expect(day.addBackEligibleExerciseKcal).toBe(320);
  });

  it('returns an empty but valid day for a date with nothing logged', () => {
    const user = createUser();

    const day = diaryRepository.getDiaryDay(user.id, '2026-03-01');

    expect(day.entries).toEqual([]);
    expect(day.totals.kcal).toBe(0);
    // The goal still has to be there — the ring needs something to measure.
    expect(day.goal.targetKcal).toBeGreaterThan(0);
  });

  it('keeps another day’s logs out of this one', () => {
    const user = createUser();

    logMeal(user.id, '2026-03-01', 400);
    logMeal(user.id, '2026-03-02', 900);
    logRepository.addWater(user.id, 250, '2026-03-02');

    const day = diaryRepository.getDiaryDay(user.id, '2026-03-01');

    expect(day.totals.kcal).toBe(400);
    expect(day.waterMl).toBe(0);
  });
});

describe('getDiaryRange', () => {
  it('returns every day in the range, including the empty ones', () => {
    const user = createUser();

    logMeal(user.id, '2026-03-02', 500);

    const days = diaryRepository.getDiaryRange(user.id, '2026-03-01', '2026-03-04');

    expect(days.map((day) => day.date)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ]);
    expect(days.map((day) => day.totals.kcal)).toEqual([0, 500, 0, 0]);
  });

  it('measures each day against the goal in force on it', () => {
    const user = createUser();

    userRepository.setGoal(
      user.id,
      {
        targetKcal: 1800,
        targetCarbsG: 200,
        targetProteinG: 150,
        targetFatG: 60,
        targetWaterMl: 2000,
      },
      '2026-03-01',
    );
    userRepository.setGoal(
      user.id,
      {
        targetKcal: 2400,
        targetCarbsG: 250,
        targetProteinG: 180,
        targetFatG: 80,
        targetWaterMl: 2500,
      },
      '2026-03-03',
    );

    const days = diaryRepository.getDiaryRange(user.id, '2026-03-01', '2026-03-04');

    expect(days.map((day) => day.goal.targetKcal)).toEqual([1800, 1800, 2400, 2400]);
  });
});

describe('activity logs', () => {
  it('stores a backdated loggedAt verbatim (UC-16 time picker)', () => {
    const user = createUser();
    const backdated = new Date('2026-03-01T08:15:00');

    logRepository.addActivity({
      userId: user.id,
      activityType: 'walking',
      caloriesBurned: 141,
      date: '2026-03-01',
      loggedAt: backdated,
    });

    const [activity] = logRepository.getActivities(user.id, '2026-03-01');

    expect(activity?.loggedAt).toEqual(backdated);
  });

  it('defaults loggedAt to now when not given', () => {
    const user = createUser();
    const before = new Date();

    logRepository.addActivity({
      userId: user.id,
      activityType: 'running',
      caloriesBurned: 351,
      date: '2026-03-01',
    });

    const [activity] = logRepository.getActivities(user.id, '2026-03-01');

    expect(activity?.loggedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe('water logs', () => {
  it('undoes the most recent drink only', () => {
    const user = createUser();

    logRepository.addWater(user.id, 250, '2026-03-01');
    logRepository.addWater(user.id, 500, '2026-03-01');
    logRepository.removeLastWater(user.id, '2026-03-01');

    expect(logRepository.getWaterMl(user.id, '2026-03-01')).toBe(250);
  });

  it('is a no-op when there is nothing to undo', () => {
    const user = createUser();

    expect(() => logRepository.removeLastWater(user.id, '2026-03-01')).not.toThrow();
    expect(logRepository.getWaterMl(user.id, '2026-03-01')).toBe(0);
  });
});

describe('setWaterTotal (UC-20 cup-tap adjust)', () => {
  it('inserts one row for the difference when increasing from a clean day', () => {
    const user = createUser();

    logRepository.setWaterTotal(user.id, '2026-03-01', 750);

    expect(logRepository.getWaterMl(user.id, '2026-03-01')).toBe(750);
    expect(logRepository.getWaterEntries(user.id, '2026-03-01')).toHaveLength(1);
  });

  it('tops up with one more row when increasing on top of existing entries', () => {
    const user = createUser();

    logRepository.addWater(user.id, 250, '2026-03-01');
    logRepository.setWaterTotal(user.id, '2026-03-01', 750);

    expect(logRepository.getWaterMl(user.id, '2026-03-01')).toBe(750);
    expect(logRepository.getWaterEntries(user.id, '2026-03-01')).toHaveLength(2);
  });

  it('removes whole rows and trims the last partial one when decreasing', () => {
    const user = createUser();

    logRepository.addWater(user.id, 250, '2026-03-01');
    logRepository.addWater(user.id, 300, '2026-03-01');
    logRepository.addWater(user.id, 250, '2026-03-01'); // total 800, most recent

    logRepository.setWaterTotal(user.id, '2026-03-01', 400);

    expect(logRepository.getWaterMl(user.id, '2026-03-01')).toBe(400);
    // The most recent (250) row is gone entirely, the 300 row is trimmed to
    // 150 to land exactly on the target, and the original 250 is untouched.
    const remaining = logRepository
      .getWaterEntries(user.id, '2026-03-01')
      .map((row) => row.amountMl)
      .sort((a, b) => a - b);
    expect(remaining).toEqual([150, 250]);
  });

  it('removes everything when decreasing to zero', () => {
    const user = createUser();

    logRepository.addWater(user.id, 250, '2026-03-01');
    logRepository.addWater(user.id, 500, '2026-03-01');

    logRepository.setWaterTotal(user.id, '2026-03-01', 0);

    expect(logRepository.getWaterMl(user.id, '2026-03-01')).toBe(0);
    expect(logRepository.getWaterEntries(user.id, '2026-03-01')).toEqual([]);
  });

  it('does nothing when the target already matches the total', () => {
    const user = createUser();

    logRepository.addWater(user.id, 250, '2026-03-01');
    logRepository.setWaterTotal(user.id, '2026-03-01', 250);

    expect(logRepository.getWaterEntries(user.id, '2026-03-01')).toHaveLength(1);
    expect(logRepository.getWaterMl(user.id, '2026-03-01')).toBe(250);
  });
});

describe('weight logs', () => {
  it('corrects the day rather than adding a second reading', () => {
    const user = createUser();

    logRepository.logWeight(user.id, 65, '2026-03-01');
    logRepository.logWeight(user.id, 64.5, '2026-03-01');

    const history = logRepository.getWeightHistory(user.id, '2026-03-01', '2026-03-01');

    expect(history).toHaveLength(1);
    expect(history[0]?.weight).toBe(64.5);
  });

  it('returns history oldest first', () => {
    const user = createUser();

    logRepository.logWeight(user.id, 66, '2026-03-03');
    logRepository.logWeight(user.id, 65, '2026-03-01');

    const history = logRepository.getWeightHistory(user.id, '2026-03-01', '2026-03-31');

    expect(history.map((row) => row.recordedAt)).toEqual(['2026-03-01', '2026-03-03']);
  });
});
