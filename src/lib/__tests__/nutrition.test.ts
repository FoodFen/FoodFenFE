import type { CatalogFood, Nutrition, UserProfile } from '@/types/models';

import {
  ageFromBirthYear,
  basalMetabolicRate,
  calculateTargets,
  dailyKcalDelta,
  goalDirection,
  kcalRemaining,
  macroEnergyShare,
  nutritionForServing,
  progressFraction,
  scaleNutrition,
  sumNutrition,
  totalDailyEnergyExpenditure,
} from '../nutrition';

/** Fixed so an age-dependent expectation cannot drift with the wall clock. */
const NOW = new Date('2026-06-15T12:00:00Z');

const profile: Pick<
  UserProfile,
  | 'gender'
  | 'birthYear'
  | 'height'
  | 'weightCurrent'
  | 'weightGoal'
  | 'activityLevel'
  | 'dietType'
  | 'weeklyRateKg'
> = {
  gender: 'male',
  birthYear: 1996,
  height: 180,
  weightCurrent: 80,
  weightGoal: 80,
  activityLevel: 'moderate',
  dietType: 'balanced',
  weeklyRateKg: 0,
};

const oats: CatalogFood = {
  id: 'oats',
  name: 'Rolled oats',
  per100g: { kcal: 389, proteinG: 16.9, carbsG: 66.3, fatG: 6.9, fiberG: 10.6 },
  servings: [
    { id: 'cup', label: '1 cup', grams: 81 },
    { id: 'g', label: 'gram', grams: 1 },
  ],
};

describe('ageFromBirthYear', () => {
  it('is the difference in calendar years', () => {
    expect(ageFromBirthYear(1996, NOW)).toBe(30);
  });

  it('never returns a negative age for a future birth year', () => {
    expect(ageFromBirthYear(2100, NOW)).toBe(0);
  });
});

describe('basalMetabolicRate', () => {
  it('applies Mifflin-St Jeor for males', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(basalMetabolicRate(profile, NOW)).toBe(1780);
  });

  it('applies the female offset', () => {
    expect(basalMetabolicRate({ ...profile, gender: 'female' }, NOW)).toBe(1780 - 166);
  });

  it('puts "other" midway between the two, not on one of them', () => {
    const male = basalMetabolicRate(profile, NOW);
    const female = basalMetabolicRate({ ...profile, gender: 'female' }, NOW);
    const other = basalMetabolicRate({ ...profile, gender: 'other' }, NOW);

    expect(other).toBe((male + female) / 2);
  });
});

describe('totalDailyEnergyExpenditure', () => {
  it('scales BMR by the activity multiplier', () => {
    expect(totalDailyEnergyExpenditure(profile, NOW)).toBeCloseTo(1780 * 1.55, 5);
  });

  it('increases with activity level', () => {
    expect(
      totalDailyEnergyExpenditure({ ...profile, activityLevel: 'very_active' }, NOW),
    ).toBeGreaterThan(
      totalDailyEnergyExpenditure({ ...profile, activityLevel: 'sedentary' }, NOW),
    );
  });
});

describe('goalDirection', () => {
  it('reads the direction from the goal weight', () => {
    expect(goalDirection({ weightCurrent: 80, weightGoal: 70 })).toBe('lose');
    expect(goalDirection({ weightCurrent: 70, weightGoal: 80 })).toBe('gain');
  });

  it('treats a goal within half a kilo as maintenance', () => {
    // Someone who rounds their weight should not be put on a deficit for it.
    expect(goalDirection({ weightCurrent: 80, weightGoal: 80.3 })).toBe('maintain');
  });
});

describe('dailyKcalDelta', () => {
  it('is zero when maintaining, whatever the rate says', () => {
    expect(dailyKcalDelta('maintain', 0.5)).toBe(0);
  });

  it('is negative when losing and positive when gaining', () => {
    expect(dailyKcalDelta('lose', 0.5)).toBeLessThan(0);
    expect(dailyKcalDelta('gain', 0.5)).toBeGreaterThan(0);
  });

  it('caps an unrealistic rate at 1000 kcal a day', () => {
    // 5 kg/week implies ~5500 kcal/day without the clamp.
    expect(dailyKcalDelta('lose', 5)).toBe(-1000);
  });
});

describe('calculateTargets', () => {
  it('splits calories across macros at the right energy density', () => {
    const targets = calculateTargets(profile, NOW);
    const macroKcal =
      targets.targetProteinG * 4 + targets.targetCarbsG * 4 + targets.targetFatG * 9;

    // Rounding each macro to a whole gram costs a few kcal of exactness.
    expect(macroKcal).toBeCloseTo(targets.targetKcal, -1);
  });

  it('never targets below the safe floor', () => {
    const targets = calculateTargets(
      {
        ...profile,
        gender: 'female',
        birthYear: 1956,
        height: 150,
        weightCurrent: 45,
        weightGoal: 40,
        activityLevel: 'sedentary',
        weeklyRateKg: 1,
      },
      NOW,
    );

    expect(targets.targetKcal).toBeGreaterThanOrEqual(1200);
  });

  it('gives a cut more protein than a bulk', () => {
    const cutting = calculateTargets(
      { ...profile, weightGoal: 70, weeklyRateKg: 0.5 },
      NOW,
    );
    const bulking = calculateTargets(
      { ...profile, weightGoal: 90, weeklyRateKg: 0.5 },
      NOW,
    );

    expect((cutting.targetProteinG * 4) / cutting.targetKcal).toBeGreaterThan(
      (bulking.targetProteinG * 4) / bulking.targetKcal,
    );
  });

  it('lets diet type override the goal-based split', () => {
    const keto = calculateTargets({ ...profile, dietType: 'keto' }, NOW);
    const balanced = calculateTargets(profile, NOW);

    expect(keto.targetCarbsG).toBeLessThan(balanced.targetCarbsG);
    expect(keto.targetFatG).toBeGreaterThan(balanced.targetFatG);
  });

  it('scales the water target with body mass', () => {
    const heavier = calculateTargets({ ...profile, weightCurrent: 100 }, NOW);
    const lighter = calculateTargets({ ...profile, weightCurrent: 60 }, NOW);

    expect(heavier.targetWaterMl).toBeGreaterThan(lighter.targetWaterMl);
  });
});

describe('scaleNutrition', () => {
  it('scales linearly from the per-100 g basis', () => {
    const half = scaleNutrition(oats.per100g, 50);

    expect(half.kcal).toBe(195); // 389 / 2, rounded
    expect(half.proteinG).toBeCloseTo(8.5, 1);
  });

  it('leaves an unreported nutrient undefined rather than zero', () => {
    const scaled = scaleNutrition({ kcal: 100, proteinG: 1, carbsG: 2, fatG: 3 }, 50);

    // "No fiber data" and "contains no fiber" must not look the same.
    expect(scaled.fiberG).toBeUndefined();
  });
});

describe('nutritionForServing', () => {
  it('resolves the serving to grams', () => {
    expect(nutritionForServing(oats, 1, 'cup').kcal).toBe(Math.round(389 * 0.81));
  });

  it('falls back to the first serving when the id is unknown', () => {
    expect(nutritionForServing(oats, 1, 'nope')).toEqual(
      nutritionForServing(oats, 1, 'cup'),
    );
  });

  it('treats the quantity as grams when a food defines no servings', () => {
    expect(nutritionForServing({ ...oats, servings: [] }, 200, 'x').kcal).toBe(778);
  });
});

describe('sumNutrition', () => {
  const a: Nutrition = { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fiberG: 1 };
  const b: Nutrition = { kcal: 250, proteinG: 12.5, carbsG: 30, fatG: 8 };

  it('adds the required fields', () => {
    const total = sumNutrition([a, b]);

    expect(total.kcal).toBe(350);
    expect(total.proteinG).toBe(17.5);
  });

  it('keeps fiber when any item reported it', () => {
    expect(sumNutrition([a, b]).fiberG).toBe(1);
  });

  it('omits fiber when no item reported it', () => {
    expect(sumNutrition([b]).fiberG).toBeUndefined();
  });

  it('returns zeros for an empty list', () => {
    expect(sumNutrition([])).toMatchObject({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });
});

describe('kcalRemaining', () => {
  it('adds exercise back into the budget', () => {
    expect(kcalRemaining(2000, 1800, 300)).toBe(500);
  });

  it('goes negative once the budget is exceeded', () => {
    expect(kcalRemaining(2000, 2400)).toBe(-400);
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
    const share = macroEnergyShare({ proteinG: 100, carbsG: 100, fatG: 100 });

    expect(share.fatG).toBeCloseTo(900 / 1700, 5);
    expect(share.proteinG + share.carbsG + share.fatG).toBeCloseTo(1, 5);
  });

  it('returns zeros rather than NaN with no macros', () => {
    expect(macroEnergyShare({ proteinG: 0, carbsG: 0, fatG: 0 })).toEqual({
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });
});
