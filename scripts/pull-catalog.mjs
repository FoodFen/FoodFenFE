// @ts-check
/**
 * Refreshes the bundled food catalog from the server.
 *
 * `GET /foods` (no `updatedSince`, no auth) returns every food, archived ones
 * included. This writes them to `src/data/catalog/foods.json` as
 * `{ snapshotAt, foods }`: each food in the built shape the app searches
 * (`BuiltCatalogFood` in `src/data/catalog/record.ts`), with `nameEn`, folded
 * name/alias fields and `<slug>-s<index>` serving ids, sorted by category then
 * name. `snapshotAt` is the response's `serverTime`, the app's first sync
 * cursor. Run before each release: `npm run catalog:pull`.
 *
 * Base URL: `EXPO_PUBLIC_API_URL`, default prod. Plain Node, no dependencies.
 * The field mapping mirrors `fromRemote` in `src/data/foodCatalog.ts`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://foodfenbe.onrender.com';
const OUT_PATH = fileURLToPath(new URL('../src/data/catalog/foods.json', import.meta.url));

const COMBINING_MARKS = /[̀-ͯ]/g;

function foldVi(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

function sourceRefOf(food) {
  if (food.sourceKind === 'team') return 'FoodFen team';
  if (food.sourceKind === 'recipe' || food.sourceKind === 'legacy') return undefined;

  return food.sourceRef ?? undefined;
}

function toBuilt(food) {
  const sourceRef = sourceRefOf(food);
  const { fiberG, ...macros } = food.per100g;

  return {
    id: food.slug,
    name: food.name,
    ...(food.nameEn ? { nameEn: food.nameEn } : {}),
    aliases: food.aliases,
    category: food.category,
    source: food.sourceKind,
    ...(sourceRef ? { sourceRef } : {}),
    verified: food.verified,
    ...(food.archived ? { archived: true } : {}),
    per100g: { ...macros, ...(fiberG !== null ? { fiberG } : {}) },
    servings: food.servings.map((serving, index) => ({
      id: `${food.slug}-s${index}`,
      label: serving.label,
      grams: serving.grams,
      ...(serving.default ? { default: true } : {}),
    })),
    nameFold: foldVi(food.name),
    ...(food.nameEn ? { nameEnFold: foldVi(food.nameEn) } : {}),
    aliasesFold: food.aliases.map(foldVi),
  };
}

const url = new URL('foods', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
const response = await fetch(url);

if (!response.ok) {
  console.error(`catalog:pull - ${url} answered ${response.status}`);
  process.exit(1);
}

const { foods, serverTime } = await response.json();

if (!Array.isArray(foods) || foods.length === 0 || typeof serverTime !== 'string') {
  console.error('catalog:pull - unexpected response shape, bundle left untouched');
  process.exit(1);
}

const built = foods
  .map(toBuilt)
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

writeFileSync(OUT_PATH, `${JSON.stringify({ snapshotAt: serverTime, foods: built }, null, 2)}\n`, 'utf8');

console.log(
  `catalog:pull - ${built.length} foods (${built.filter((f) => f.archived).length} archived), snapshotAt ${serverTime}`,
);
