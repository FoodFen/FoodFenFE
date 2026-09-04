import { isNotNull } from 'drizzle-orm';

import { foodEntry } from '@/db/schema';
import { createTestDatabase } from '@/db/testDatabase';
import type { TestDatabase } from '@/db/testDatabase';

import * as entryRepository from '../entryRepository';
import * as userRepository from '../userRepository';

let mockDb: TestDatabase;

// The repositories import the app's database singleton, which is backed by
// expo-sqlite and cannot open under Jest. Swapping it for a better-sqlite3
// instance built from the same migrations lets the real repository code run
// against real SQL.
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
    weightGoal: 60,
    activityLevel: 'moderate',
    dietType: 'balanced',
    weeklyRateKg: 0.5,
  }).user;
}

const chicken = {
  name: 'Chicken breast',
  quantityG: 150,
  kcal: 248,
  proteinG: 46.5,
  carbsG: 0,
  fatG: 5.4,
};

const rice = {
  name: 'White rice',
  quantityG: 200,
  kcal: 260,
  proteinG: 5.4,
  carbsG: 56.4,
  fatG: 0.6,
};

beforeEach(() => {
  mockDb = createTestDatabase();
});

describe('createEntry', () => {
  it('stores the meal with its ingredients', () => {
    const user = createUser();

    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Chicken and rice',
      mealType: 'lunch',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken, rice],
    });

    expect(entry.name).toBe('Chicken and rice');
    expect(entry.ingredients).toHaveLength(2);
  });

  it('derives the totals from the ingredients rather than trusting a caller', () => {
    const user = createUser();

    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Chicken and rice',
      mealType: 'lunch',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken, rice],
    });

    expect(entry.totalKcal).toBe(chicken.kcal + rice.kcal);
    expect(entry.proteinG).toBeCloseTo(51.9, 1);
    expect(entry.carbsG).toBeCloseTo(56.4, 1);
  });

  it('marks the new row as not yet synced', () => {
    const user = createUser();

    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Toast',
      mealType: 'breakfast',
      inputMethod: 'manual',
      loggedOn: '2026-03-01',
      ingredients: [chicken],
    });

    // This is what a future push pass looks for.
    expect(entry.syncedAt).toBeNull();
    expect(entry.remoteId).toBeNull();
  });

  it('accepts a meal with no ingredients as an empty total', () => {
    const user = createUser();

    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Something',
      mealType: 'snack',
      inputMethod: 'manual',
      loggedOn: '2026-03-01',
      ingredients: [],
    });

    expect(entry.totalKcal).toBe(0);
    expect(entry.ingredients).toEqual([]);
  });
});

describe('updateEntry', () => {
  it('re-sums the totals when the ingredients change', () => {
    const user = createUser();
    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken, rice],
    });

    const updated = entryRepository.updateEntry(entry.id, { ingredients: [chicken] });

    expect(updated.totalKcal).toBe(chicken.kcal);
    expect(updated.ingredients).toHaveLength(1);
  });

  it('moves a meal to another day', () => {
    const user = createUser();
    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken],
    });

    entryRepository.updateEntry(entry.id, { loggedOn: '2026-03-02' });

    expect(entryRepository.getEntriesForDay(user.id, '2026-03-01')).toHaveLength(0);
    expect(entryRepository.getEntriesForDay(user.id, '2026-03-02')).toHaveLength(1);
  });
});

describe('deleteEntry', () => {
  it('hides the meal from reads', () => {
    const user = createUser();
    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken],
    });

    entryRepository.deleteEntry(entry.id);

    expect(entryRepository.getEntry(entry.id)).toBeUndefined();
    expect(entryRepository.getEntriesForDay(user.id, '2026-03-01')).toEqual([]);
  });

  it('soft deletes, so the deletion itself can still be pushed', () => {
    const user = createUser();
    const entry = entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken],
    });

    entryRepository.deleteEntry(entry.id);

    // A row that vanished could never be deleted server-side.
    const softDeleted = mockDb
      .select()
      .from(foodEntry)
      .where(isNotNull(foodEntry.deletedAt))
      .all();

    expect(softDeleted).toHaveLength(1);
    expect(softDeleted[0]?.syncedAt).toBeNull();
  });
});

describe('getEntriesInRange', () => {
  it('returns only days inside the range, oldest first', () => {
    const user = createUser();

    for (const date of ['2026-02-28', '2026-03-01', '2026-03-05']) {
      entryRepository.createEntry({
        userId: user.id,
        name: `Meal ${date}`,
        mealType: 'lunch',
        inputMethod: 'type',
        loggedOn: date,
        ingredients: [chicken],
      });
    }

    const entries = entryRepository.getEntriesInRange(
      user.id,
      '2026-03-01',
      '2026-03-31',
    );

    expect(entries.map((entry) => entry.loggedOn)).toEqual(['2026-03-01', '2026-03-05']);
  });

  it('attaches each entry its own ingredients', () => {
    const user = createUser();

    entryRepository.createEntry({
      userId: user.id,
      name: 'Breakfast',
      mealType: 'breakfast',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken],
    });
    entryRepository.createEntry({
      userId: user.id,
      name: 'Lunch',
      mealType: 'lunch',
      inputMethod: 'type',
      loggedOn: '2026-03-01',
      ingredients: [chicken, rice],
    });

    const entries = entryRepository.getEntriesForDay(user.id, '2026-03-01');

    expect(entries.map((entry) => entry.ingredients.length)).toEqual([1, 2]);
  });
});
