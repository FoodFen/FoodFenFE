import {
  ACTIVITY_PRESETS,
  caloriesBurnedForPreset,
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
