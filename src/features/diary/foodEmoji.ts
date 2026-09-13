import type { FoodEntry, MealType } from '@/types/models';

/**
 * A single food emoji for a logged entry, guessed from its name.
 *
 * The entry has no category column, so this matches folded keywords in the name
 * against an ordered table (first hit wins) and falls back to a meal-type glyph.
 * It is decorative — a wrong guess only picks a less-fitting emoji.
 */

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

// Ordered: earlier, more specific entries win over later broad ones.
const KEYWORD_EMOJI: readonly (readonly [string, string])[] = [
  ['banh mi', '🥖'],
  ['pizza', '🍕'],
  ['lap xuong', '🌭'],
  ['xuc xich', '🌭'],
  ['pho', '🍜'],
  ['bun', '🍜'],
  ['mien', '🍜'],
  ['hu tieu', '🍜'],
  ['mi ', '🍜'],
  ['nui', '🍜'],
  ['lau', '🍲'],
  ['chao', '🍲'],
  ['sup', '🍲'],
  ['com', '🍚'],
  ['xoi', '🍙'],
  ['banh', '🥮'],
  ['ga', '🍗'],
  ['bo', '🥩'],
  ['heo', '🥩'],
  ['thit', '🥩'],
  ['nem', '🥩'],
  ['gio', '🥩'],
  ['ca vien', '🍢'],
  ['tom', '🦐'],
  ['ca ', '🐟'],
  ['muc', '🦑'],
  ['hai san', '🦐'],
  ['trung', '🥚'],
  ['rau', '🥗'],
  ['salad', '🥗'],
  ['goi', '🥗'],
  ['dau', '🫘'],
  ['pho mai', '🧀'],
  ['sua chua', '🍨'],
  ['sua', '🥛'],
  ['ca phe', '☕'],
  ['tra ', '🧋'],
  ['tra sua', '🧋'],
  ['nuoc', '🥤'],
  ['bia', '🍺'],
  ['sinh to', '🥤'],
  ['che', '🍧'],
  ['kem', '🍦'],
  ['banh ngot', '🍰'],
  ['keo', '🍬'],
  ['socola', '🍫'],
  ['chuoi', '🍌'],
  ['tao', '🍎'],
  ['cam', '🍊'],
  ['xoai', '🥭'],
  ['dua hau', '🍉'],
  ['trai cay', '🍎'],
  ['hoa qua', '🍎'],
  ['khoai', '🍟'],
  ['chien', '🍟'],
  ['ran', '🍳'],
  ['hamburger', '🍔'],
  ['burger', '🍔'],
];

const MEAL_FALLBACK: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🍱',
  dinner: '🍽️',
  snack: '🍪',
};

export function foodEmojiFor(entry: Pick<FoodEntry, 'name' | 'mealType'>): string {
  const name = fold(` ${entry.name} `);

  for (const [keyword, emoji] of KEYWORD_EMOJI) {
    if (name.includes(keyword)) return emoji;
  }

  return MEAL_FALLBACK[entry.mealType] ?? '🍽️';
}
