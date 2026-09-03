import type { DiaryDay, FoodEntry, MealType } from '@/types/models';

import { averageByMeal, currentStreak, summarizeTrends } from '../trends';

const goals = { calories: 2000, protein: 150, carbs: 200, fat: 67 };

function entry(mealType: MealType, calories: number): FoodEntry {
  return {
    id: `${mealType}-${calories}`,
    date: '2026-03-01',
    mealType,
    food: {
      id: 'f',
      name: 'Food',
      per100g: { calories, protein: 0, carbs: 0, fat: 0 },
      servingUnits: [],
    },
    quantity: 1,
    servingUnitId: 'g',
    nutrition: { calories, protein: 10, carbs: 20, fat: 5 },
    loggedAt: '2026-03-01T12:00:00.000Z',
  };
}

function day(date: string, calories: number[]): DiaryDay {
  const entries = calories.map((value, index) =>
    entry((['breakfast', 'lunch', 'dinner', 'snack'] as const)[index % 4]!, value),
  );

  return {
    date,
    entries,
    totals: {
      calories: calories.reduce((sum, value) => sum + value, 0),
      protein: entries.length * 10,
      carbs: entries.length * 20,
      fat: entries.length * 5,
    },
    goals,
    exerciseCalories: 0,
    waterMl: 0,
  };
}

function emptyDay(date: string): DiaryDay {
  return {
    date,
    entries: [],
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    goals,
    exerciseCalories: 0,
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
    expect(summary.averageCalories).toBe(1500);
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
    const summary = summarizeTrends([day('2026-03-01', [1500])]);

    expect(summary.averageDelta).toBe(-500);
  });

  it('handles an entirely empty window without dividing by zero', () => {
    const summary = summarizeTrends([emptyDay('2026-03-01')]);

    expect(summary.averageCalories).toBe(0);
    expect(summary.averageMacroShare).toEqual({ protein: 0, carbs: 0, fat: 0 });
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
      day('2026-03-01', [400, 600]), // breakfast 400, lunch 600
      day('2026-03-02', [200, 400]), // breakfast 200, lunch 400
    ]);

    expect(result.breakfast).toBe(300);
    expect(result.lunch).toBe(500);
    expect(result.dinner).toBe(0);
  });
});
