import type { DailyGoal, DiaryDay, FoodEntry, MealType } from '@/types/models';

import { averageByMeal, currentStreak, summarizeTrends } from '../trends';

const goal: DailyGoal = {
  id: 'goal',
  userId: 'user',
  targetKcal: 2000,
  targetCarbsG: 200,
  targetProteinG: 150,
  targetFatG: 67,
  targetWaterMl: 2000,
  effectiveDate: '2026-03-01',
  remoteId: null,
  updatedAt: new Date(),
  syncedAt: null,
  deletedAt: null,
};

function entry(mealType: MealType, kcal: number): FoodEntry {
  return {
    id: `${mealType}-${kcal}`,
    userId: 'user',
    name: 'Meal',
    inputMethod: 'type',
    imageUrl: null,
    totalKcal: kcal,
    carbsG: 20,
    proteinG: 10,
    fatG: 5,
    fiberG: null,
    amount: null,
    amountUnit: null,
    aiFeedback: null,
    mealType,
    loggedAt: new Date('2026-03-01T12:00:00Z'),
    loggedOn: '2026-03-01',
    remoteId: null,
    updatedAt: new Date(),
    syncedAt: null,
    deletedAt: null,
    ingredients: [],
  };
}

function day(date: string, kcals: number[]): DiaryDay {
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const entries = kcals.map((kcal, index) => entry(meals[index % 4]!, kcal));

  return {
    date,
    entries,
    totals: {
      kcal: kcals.reduce((sum, value) => sum + value, 0),
      carbsG: entries.length * 20,
      proteinG: entries.length * 10,
      fatG: entries.length * 5,
    },
    goal,
    exerciseKcal: 0,
    waterMl: 0,
  };
}

function emptyDay(date: string): DiaryDay {
  return {
    date,
    entries: [],
    totals: { kcal: 0, carbsG: 0, proteinG: 0, fatG: 0 },
    goal,
    exerciseKcal: 0,
    waterMl: 0,
  };
}

describe('summarizeTrends', () => {
  it('averages only the days that were logged', () => {
    const summary = summarizeTrends([
      day('2026-03-01', [1000]),
      emptyDay('2026-03-02'),
      day('2026-03-03', [2000]),
    ]);

    // A blank day is "did not log", not "ate nothing" — including it would
    // drag the average to 1000.
    expect(summary.averageKcal).toBe(1500);
    expect(summary.daysLogged).toBe(2);
    expect(summary.totalDays).toBe(3);
  });

  it('sorts the series oldest first regardless of input order', () => {
    const summary = summarizeTrends([day('2026-03-03', [100]), day('2026-03-01', [200])]);

    expect(summary.series.map((point) => point.date)).toEqual([
      '2026-03-01',
      '2026-03-03',
    ]);
  });

  it('reports a deficit as a negative delta', () => {
    expect(summarizeTrends([day('2026-03-01', [1500])]).averageDelta).toBe(-500);
  });

  it('handles an entirely empty window without dividing by zero', () => {
    const summary = summarizeTrends([emptyDay('2026-03-01')]);

    expect(summary.averageKcal).toBe(0);
    expect(summary.averageMacroShare).toEqual({ proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('currentStreak', () => {
  it('counts back from the most recent day', () => {
    expect(
      currentStreak([
        day('2026-03-01', [100]),
        emptyDay('2026-03-02'),
        day('2026-03-03', [100]),
        day('2026-03-04', [100]),
      ]),
    ).toBe(2);
  });

  it('is zero when the latest day is blank', () => {
    expect(currentStreak([day('2026-03-01', [100]), emptyDay('2026-03-02')])).toBe(0);
  });
});

describe('averageByMeal', () => {
  it('averages each meal across logged days, counting unlogged meals as zero', () => {
    const result = averageByMeal([
      day('2026-03-01', [400, 600]),
      day('2026-03-02', [200, 400]),
    ]);

    expect(result.breakfast).toBe(300);
    expect(result.lunch).toBe(500);
    expect(result.dinner).toBe(0);
  });
});
