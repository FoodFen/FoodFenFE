import type { CatalogFood, CatalogServing } from '@/types/models';

/**
 * The bundled food reference list.
 *
 * The app has to be useful the moment it is installed, with no network and no
 * account, so a small set of staples ships in the bundle. Picking one prefills
 * an ingredient's numbers; the values are then copied onto the `ingredient`
 * row, so this list is never consulted again when reading history.
 *
 * Figures are common per-100 g reference values for the generic form of each
 * food — close enough to track with, not a substitute for a real food
 * database. A full catalog, barcode lookup and AI extraction all arrive with
 * the backend.
 */

type SeedFood = Omit<CatalogFood, 'servings'> & {
  servings: Omit<CatalogServing, 'id'>[];
};

/** Serving ids are derived from the food id, so they are stable and unique. */
function seed(food: SeedFood): CatalogFood {
  return {
    ...food,
    servings: food.servings.map((serving, index) => ({
      ...serving,
      id: `${food.id}-serving-${index}`,
    })),
  };
}

export const CATALOG_FOODS: CatalogFood[] = [
  seed({
    id: 'seed-chicken-breast',
    name: 'Chicken breast, cooked',
    per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
    servings: [
      { label: '100 g', grams: 100 },
      { label: '1 breast', grams: 172 },
    ],
  }),
  seed({
    id: 'seed-salmon',
    name: 'Salmon, cooked',
    per100g: { kcal: 208, proteinG: 20, carbsG: 0, fatG: 13 },
    servings: [
      { label: '100 g', grams: 100 },
      { label: '1 fillet', grams: 154 },
    ],
  }),
  seed({
    id: 'seed-ground-beef',
    name: 'Ground beef, 85% lean, cooked',
    per100g: { kcal: 250, proteinG: 26, carbsG: 0, fatG: 17 },
    servings: [
      { label: '100 g', grams: 100 },
      { label: '1 patty', grams: 85 },
    ],
  }),
  seed({
    id: 'seed-egg',
    name: 'Egg, whole',
    per100g: { kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11 },
    servings: [
      { label: '1 large', grams: 50 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-tofu',
    name: 'Tofu, firm',
    per100g: { kcal: 144, proteinG: 15.5, carbsG: 3.9, fatG: 8.7, fiberG: 2.3 },
    servings: [
      { label: '100 g', grams: 100 },
      { label: '1 block', grams: 396 },
    ],
  }),
  seed({
    id: 'seed-greek-yogurt',
    name: 'Greek yogurt, plain nonfat',
    per100g: { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4 },
    servings: [
      { label: '1 container', grams: 170 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-milk-whole',
    name: 'Milk, whole',
    per100g: { kcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3 },
    servings: [
      { label: '1 cup', grams: 244 },
      { label: '100 ml', grams: 103 },
    ],
  }),
  seed({
    id: 'seed-cheddar',
    name: 'Cheddar cheese',
    per100g: { kcal: 403, proteinG: 25, carbsG: 1.3, fatG: 33 },
    servings: [
      { label: '1 slice', grams: 28 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-white-rice',
    name: 'White rice, cooked',
    per100g: { kcal: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3, fiberG: 0.4 },
    servings: [
      { label: '1 cup', grams: 158 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-brown-rice',
    name: 'Brown rice, cooked',
    per100g: { kcal: 123, proteinG: 2.7, carbsG: 25.6, fatG: 1, fiberG: 1.6 },
    servings: [
      { label: '1 cup', grams: 195 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-pasta',
    name: 'Pasta, cooked',
    per100g: { kcal: 131, proteinG: 5, carbsG: 25, fatG: 1.1, fiberG: 1.8 },
    servings: [
      { label: '1 cup', grams: 140 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-oats',
    name: 'Rolled oats, dry',
    per100g: { kcal: 389, proteinG: 16.9, carbsG: 66.3, fatG: 6.9, fiberG: 10.6 },
    servings: [
      { label: '1 cup', grams: 81 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-bread-wholewheat',
    name: 'Whole wheat bread',
    per100g: { kcal: 247, proteinG: 13, carbsG: 41, fatG: 3.4, fiberG: 7 },
    servings: [
      { label: '1 slice', grams: 43 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-bread-white',
    name: 'White bread',
    per100g: { kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2, fiberG: 2.7 },
    servings: [
      { label: '1 slice', grams: 36 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-potato',
    name: 'Potato, baked',
    per100g: { kcal: 93, proteinG: 2.5, carbsG: 21.2, fatG: 0.1, fiberG: 2.2 },
    servings: [
      { label: '1 medium', grams: 173 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-sweet-potato',
    name: 'Sweet potato, baked',
    per100g: { kcal: 90, proteinG: 2, carbsG: 20.7, fatG: 0.2, fiberG: 3.3 },
    servings: [
      { label: '1 medium', grams: 151 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-black-beans',
    name: 'Black beans, cooked',
    per100g: { kcal: 132, proteinG: 8.9, carbsG: 23.7, fatG: 0.5, fiberG: 8.7 },
    servings: [
      { label: '1 cup', grams: 172 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-banana',
    name: 'Banana',
    per100g: { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6 },
    servings: [
      { label: '1 medium', grams: 118 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-apple',
    name: 'Apple',
    per100g: { kcal: 52, proteinG: 0.3, carbsG: 13.8, fatG: 0.2, fiberG: 2.4 },
    servings: [
      { label: '1 medium', grams: 182 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-orange',
    name: 'Orange',
    per100g: { kcal: 47, proteinG: 0.9, carbsG: 11.8, fatG: 0.1, fiberG: 2.4 },
    servings: [
      { label: '1 medium', grams: 131 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-avocado',
    name: 'Avocado',
    per100g: { kcal: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7, fiberG: 6.7 },
    servings: [
      { label: '1 medium', grams: 201 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-broccoli',
    name: 'Broccoli, cooked',
    per100g: { kcal: 35, proteinG: 2.4, carbsG: 7.2, fatG: 0.4, fiberG: 3.3 },
    servings: [
      { label: '1 cup', grams: 156 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-spinach',
    name: 'Spinach, raw',
    per100g: { kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, fiberG: 2.2 },
    servings: [
      { label: '1 cup', grams: 30 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-almonds',
    name: 'Almonds',
    per100g: { kcal: 579, proteinG: 21.2, carbsG: 21.6, fatG: 49.9, fiberG: 12.5 },
    servings: [
      { label: '1 oz (23 nuts)', grams: 28 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-peanut-butter',
    name: 'Peanut butter',
    per100g: { kcal: 588, proteinG: 25, carbsG: 20, fatG: 50, fiberG: 6 },
    servings: [
      { label: '1 tbsp', grams: 16 },
      { label: '100 g', grams: 100 },
    ],
  }),
  seed({
    id: 'seed-olive-oil',
    name: 'Olive oil',
    per100g: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 },
    servings: [
      { label: '1 tbsp', grams: 13.5 },
      { label: '1 tsp', grams: 4.5 },
    ],
  }),
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Substring search over the bundled list.
 *
 * Deliberately simple: the list is small enough that scanning it costs
 * nothing, and ranking is the backend's job once a real catalog exists.
 */
export function searchCatalog(query: string, limit = 25): CatalogFood[] {
  const needle = normalize(query);
  if (!needle) return [];

  return CATALOG_FOODS.filter(
    (food) =>
      normalize(food.name).includes(needle) ||
      (food.brand !== undefined && normalize(food.brand).includes(needle)),
  ).slice(0, limit);
}

export function findCatalogFood(id: string): CatalogFood | undefined {
  return CATALOG_FOODS.find((food) => food.id === id);
}
