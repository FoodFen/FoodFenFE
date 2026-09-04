import { create } from 'zustand';

import type { IngredientInput } from '@/data/entryRepository';
import { suggestedMealType } from '@/features/diary/selectors';
import type { DateKey } from '@/lib/date';
import { todayKey } from '@/lib/date';
import { generateLocalId } from '@/lib/id';
import { sumNutrition } from '@/lib/nutrition';
import type { InputMethod, MealType, Nutrition } from '@/types/models';

/**
 * The meal being composed.
 *
 * Lives in a store rather than screen state because the flow spans two
 * screens: the composer and the ingredient picker. Route params cannot carry a
 * growing list of ingredients between them, and lifting the draft out means
 * backing out of the picker cannot lose what has already been added.
 *
 * Nothing here touches the database. `useLogMeal` writes the draft once, when
 * the user saves.
 */

export interface DraftIngredient extends IngredientInput {
  /** Stable list key; ingredients only get database ids when the meal is saved. */
  key: string;
}

interface DraftState {
  name: string;
  mealType: MealType;
  inputMethod: InputMethod;
  loggedOn: DateKey;
  ingredients: DraftIngredient[];

  /** Begin a new meal, discarding anything half-composed. */
  start: (date: DateKey, mealType: MealType) => void;
  setName: (name: string) => void;
  setMealType: (mealType: MealType) => void;
  addIngredient: (ingredient: IngredientInput) => void;
  removeIngredient: (key: string) => void;
  reset: () => void;
}

function emptyDraft() {
  return {
    name: '',
    mealType: suggestedMealType(),
    inputMethod: 'type' as InputMethod,
    loggedOn: todayKey(),
    ingredients: [] as DraftIngredient[],
  };
}

export const useDraftStore = create<DraftState>((set) => ({
  ...emptyDraft(),

  start: (date, mealType) => set({ ...emptyDraft(), loggedOn: date, mealType }),

  setName: (name) => set({ name }),

  setMealType: (mealType) => set({ mealType }),

  addIngredient: (ingredient) =>
    set((state) => ({
      ingredients: [
        ...state.ingredients,
        { ...ingredient, key: generateLocalId('draft') },
      ],
    })),

  removeIngredient: (key) =>
    set((state) => ({
      ingredients: state.ingredients.filter((row) => row.key !== key),
    })),

  reset: () => set(emptyDraft()),
}));

/** Running totals for the draft, the same sum the saved entry will store. */
export function draftTotals(ingredients: readonly DraftIngredient[]): Nutrition {
  return sumNutrition(
    ingredients.map((row) => ({
      kcal: row.kcal,
      carbsG: row.carbsG,
      proteinG: row.proteinG,
      fatG: row.fatG,
      fiberG: row.fiberG,
    })),
  );
}

/**
 * A name for a meal the user did not name.
 *
 * Falls back to its ingredients rather than "Untitled", so an unnamed meal is
 * still recognisable in the diary a week later.
 */
export function draftName(name: string, ingredients: readonly DraftIngredient[]): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;

  if (ingredients.length === 0) return 'Meal';

  const [first, second] = ingredients;

  if (ingredients.length === 1 || !second) return first?.name ?? 'Meal';

  return `${first?.name} + ${ingredients.length - 1} more`;
}
