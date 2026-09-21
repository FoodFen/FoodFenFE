import {
  ACTIVITY_PRESETS,
  caloriesBurnedForPreset,
  estimateStepsCalories,
  getActivityPreset,
} from '../activity';

const walking = getActivityPreset('walking')!;

describe('caloriesBurnedForPreset', () => {
  it('returns the base rate at exactly 30 minutes', () => {
    expect(caloriesBurnedForPreset(walking, 30)).toBe(walking.kcalPer30Min);
  });

  it('halves (and rounds) at 15 minutes', () => {
    expect(caloriesBurnedForPreset(walking, 15)).toBe(Math.round(walking.kcalPer30Min / 2));
  });

  it('scales up for longer durations', () => {
    expect(caloriesBurnedForPreset(walking, 60)).toBe(walking.kcalPer30Min * 2);
  });
});

describe('getActivityPreset', () => {
  it('finds every preset in the table by its own id', () => {
    for (const preset of ACTIVITY_PRESETS) {
      expect(getActivityPreset(preset.id)).toEqual(preset);
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getActivityPreset('not-a-real-activity')).toBeUndefined();
  });
});

describe('estimateStepsCalories', () => {
  it('is zero for zero steps', () => {
    expect(estimateStepsCalories(0, 70)).toBe(0);
  });

  it('matches the formula: (steps / 100) * 3.5 MET * 3.5 * weightKg / 200', () => {
    // 1,000 steps at 70 kg: (1000/100) * 3.5 * 3.5 * 70 / 200 = 42.875 -> 43
    expect(estimateStepsCalories(1000, 70)).toBe(43);
  });

  it('scales linearly with steps at a fixed weight', () => {
    expect(estimateStepsCalories(20000, 70)).toBe(estimateStepsCalories(10000, 70) * 2);
  });

  it('scales linearly with weight at a fixed step count', () => {
    expect(estimateStepsCalories(10000, 140)).toBe(estimateStepsCalories(10000, 70) * 2);
  });
});
