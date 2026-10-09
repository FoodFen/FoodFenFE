import { dishToManualEntry, formatVnd } from '../mappers';

const dish = {
  id: 'd1',
  name: 'Cơm gà',
  description: null,
  imageUrl: null,
  price: 45000,
  servingG: 350,
  kcal: 640,
  proteinG: 32.04,
  carbsG: 70,
  fatG: 18.26,
  fiberG: null,
};

describe('dishToManualEntry', () => {
  it('copies name, kcal, macros and serving into a manual entry input', () => {
    expect(dishToManualEntry(dish, 'lunch', '2026-10-10')).toEqual({
      name: 'Cơm gà',
      emoji: null,
      mealType: 'lunch',
      loggedOn: '2026-10-10',
      amount: 350,
      amountUnit: 'g',
      totalKcal: 640,
      carbsG: 70,
      proteinG: 32,
      fatG: 18.3,
    });
  });

  it('rounds kcal to a whole number', () => {
    expect(
      dishToManualEntry({ ...dish, kcal: 640.6 }, 'lunch', '2026-10-10').totalKcal,
    ).toBe(641);
  });
});

describe('formatVnd', () => {
  it('groups thousands with dots and appends the dong sign', () => {
    expect(formatVnd(45000)).toBe('45.000₫');
    expect(formatVnd(1250000)).toBe('1.250.000₫');
    expect(formatVnd(0)).toBe('0₫');
  });
});
