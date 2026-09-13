import { foodEmojiFor } from '../foodEmoji';

describe('foodEmojiFor', () => {
  it('matches a keyword regardless of diacritics', () => {
    expect(foodEmojiFor({ name: 'Phở bò', mealType: 'lunch' })).toBe('🍜');
    expect(foodEmojiFor({ name: 'pho bo', mealType: 'lunch' })).toBe('🍜');
  });

  it('folds đ to d when matching', () => {
    expect(foodEmojiFor({ name: 'Đậu hũ chiên', mealType: 'dinner' })).toBe('🫘');
  });

  it('lets a specific keyword win over a broader one', () => {
    expect(foodEmojiFor({ name: 'Bánh mì thịt', mealType: 'breakfast' })).toBe('🥖');
  });

  it('falls back to the meal-type emoji for an unknown name', () => {
    expect(foodEmojiFor({ name: 'Món lạ', mealType: 'breakfast' })).toBe('🍳');
    expect(foodEmojiFor({ name: 'Món lạ', mealType: 'snack' })).toBe('🍪');
  });

  it('is safe for an empty name', () => {
    expect(foodEmojiFor({ name: '', mealType: 'dinner' })).toBe('🍽️');
  });
});
