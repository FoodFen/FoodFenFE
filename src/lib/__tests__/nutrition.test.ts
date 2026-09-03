import type { Food, Nutrition, UserProfile } from '@/types/models';

import {
  basalMetabolicRate,
  calculateGoals,
  caloriesRemaining,
  dailyCalorieDelta,
  macroEnergyShare,
  nutritionForPortion,
  progressFraction,
  scaleNutrition,
  sumNutrition,
  totalDailyEnergyExpenditure,
} from '../nutrition';

const profile: UserProfile = {
  id: 'u1',
  email: 'test@example.com',
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderate',
  goalKind: 'maintain',
  weeklyRateKg: 0,
};

const oats: Food = {
  id: 'f1',
  name: 'Rolled oats',
  per100g: {
    calories: 379,
    protein: 13.2,
    carbs: 67.7,
    fat: 6.5,
    fiber: 10.1,
  },
  servingUnits: [
    { id: 'cup', label: '1 cup', grams: 81 },
    { id: 'g', label: 'gram', grams: 1 },
  ],
};

describe('basalMetabolicRate', () => {
  it('applies the Mifflin-St Jeor equation for males', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(basalMetabolicRate(profile)).toBe(1780);
  });

  it('applies the female offset', () => {
    // The two sexes differ by exactly 166 kcal at the same body metrics.
    expect(basalMetabolicRate({ ...profile, sex: 'female' })).toBe(1780 - 166);
  });
});

describe('totalDailyEnergyExpenditure', () => {
  it('scales BMR by the activity multiplier', () => {
    expect(totalDailyEnergyExpenditure(profile)).toBeCloseTo(1780 * 1.55, 5);
  });

  it('increases monotonically with activity level', () => {
    const sedentary = totalDailyEnergyExpenditure({
      ...profile,
      activityLevel: 'sedentary',
    });
    const veryActive = totalDailyEnergyExpenditure({
      ...profile,
      activityLevel: 'very_active',
    });

    expect(veryActive).toBeGreaterThan(sedentary);
  });
});

describe('dailyCalorieDelta', () => {
  it('is zero when maintaining', () => {
    expect(dailyCalorieDelta('maintain', 0.5)).toBe(0);
  });

  it('is negative when losing and positive when gaining', () => {
    expect(dailyCalorieDelta('lose', 0.5)).toBeLessThan(0);
    expect(dailyCalorieDelta('gain', 0.5)).toBeGreaterThan(0);
  });

  it('caps an unrealistic rate at 1000 kcal per day', () => {
    // 5 kg/week would imply ~5500 kcal/day without the clamp.
    expect(dailyCalorieDelta('lose', 5)).toBe(-1000);
  });
});

describe('calculateGoals', () => {
  it('splits calories across macros with the right energy density', () => {
    const goals = calculateGoals(profile);
    const macroCalories = goals.protein * 4 + goals.carbs * 4 + goals.fat * 9;

    // Rounding each macro to a whole gram costs a few kcal of exactness.
    expect(macroCalories).toBeCloseTo(goals.calories, -1);
  });

  it('never targets below the safe floor', () => {
    const goals = calculateGoals({
      ...profile,
      sex: 'female',
      age: 70,
      heightCm: 150,
      weightKg: 45,
      activityLevel: 'sedentary',
      goalKind: 'lose',
      weeklyRateKg: 1,
    });

    expect(goals.calories).toBeGreaterThanOrEqual(1200);
  });

  it('returns custom goals untouched when the user set them', () => {
    const customGoals = { calories: 2222, protein: 180, carbs: 200, fat: 70 };

    expect(calculateGoals({ ...profile, customGoals })).toEqual(customGoals);
  });

  it('gives a cut more protein than a bulk', () => {
    const cutting = calculateGoals({ ...profile, goalKind: 'lose', weeklyRateKg: 0.5 });
    const bulking = calculateGoals({ ...profile, goalKind: 'gain', weeklyRateKg: 0.5 });

    const cutShare = (cutting.protein * 4) / cutting.calories;
    const bulkShare = (bulking.protein * 4) / bulking.calories;

    expect(cutShare).toBeGreaterThan(bulkShare);
  });
});

describe('scaleNutrition', () => {
  it('scales linearly from the per-100 g basis', () => {
    const scaled = scaleNutrition(oats.per100g, 50);

    expect(scaled.calories).toBe(190); // 379 / 2, rounded
    expect(scaled.protein).toBeCloseTo(6.6, 1);
  });

  it('leaves unreported nutrients undefined rather than zero', () => {
    const scaled = scaleNutrition(oats.per100g, 50);

    // "No sugar data" and "contains no sugar" must not look the same.
    expect(scaled.sugar).toBeUndefined();
    expect(scaled.fiber).toBeCloseTo(5.1, 1);
  });
});

describe('nutritionForPortion', () => {
  it('resolves the serving unit to grams', () => {
    const oneCup = nutritionForPortion(oats, 1, 'cup');

    expect(oneCup.calories).toBe(Math.round(379 * 0.81));
  });

  it('falls back to the first unit when the id is unknown', () => {
    expect(nutritionForPortion(oats, 1, 'nope')).toEqual(
      nutritionForPortion(oats, 1, 'cup'),
    );
  });

  it('treats quantity as grams when the food has no serving units', () => {
    const byWeight = nutritionForPortion({ ...oats, servingUnits: [] }, 200, 'x');

    expect(byWeight.calories).toBe(758);
  });
});

describe('sumNutrition', () => {
  const a: Nutrition = { calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 1 };
  const b: Nutrition = { calories: 250, protein: 12.5, carbs: 30, fat: 8 };

  it('adds the required fields', () => {
    const total = sumNutrition([a, b]);

    expect(total.calories).toBe(350);
    expect(total.protein).toBe(17.5);
  });

  it('keeps an optional field when any entry reported it', () => {
    expect(sumNutrition([a, b]).fiber).toBe(1);
  });

  it('omits an optional field no entry reported', () => {
    expect(sumNutrition([a, b]).sugar).toBeUndefined();
  });

  it('returns zeros for an empty list', () => {
    expect(sumNutrition([])).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('caloriesRemaining', () => {
  it('adds exercise back into the budget', () => {
    expect(caloriesRemaining(2000, 1800, 300)).toBe(500);
  });

  it('goes negative once the budget is exceeded', () => {
    expect(caloriesRemaining(2000, 2400)).toBe(-400);
  });
});

describe('progressFraction', () => {
  it('clamps to the 0-1 range', () => {
    expect(progressFraction(3000, 2000)).toBe(1);
    expect(progressFraction(-5, 2000)).toBe(0);
  });

  it('is zero for a non-positive target rather than dividing by zero', () => {
    expect(progressFraction(500, 0)).toBe(0);
  });
});

describe('macroEnergyShare', () => {
  it('weights fat at 9 kcal per gram', () => {
    // 100 g fat = 900 kcal, 100 g protein = 400 kcal, 100 g carbs = 400 kcal.
    const share = macroEnergyShare({ protein: 100, carbs: 100, fat: 100 });

    expect(share.fat).toBeCloseTo(900 / 1700, 5);
    expect(share.protein + share.carbs + share.fat).toBeCloseTo(1, 5);
  });

  it('returns zeros rather than NaN with no macros', () => {
    expect(macroEnergyShare({ protein: 0, carbs: 0, fat: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});
