import type { CatalogFood } from '@/types/models';

import rawFoods from './catalog/foods.json';
import type { BuiltCatalogFood } from './catalog/record';

/**
 * The bundled food catalog.
 *
 * ~670 Vietnamese-first foods, generated from `data/catalog/*.json` by
 * `scripts/build-catalog.mjs` into `./catalog/foods.json` (committed). The app
 * has to be useful the moment it is installed with no network, so the whole
 * list ships in the bundle and search runs in memory. Picking a food prefills
 * an ingredient's numbers, which are then copied onto the `ingredient` row —
 * the catalog is never consulted when reading history.
 */

// foods.json is generated to exactly the BuiltCatalogFood shape by the build
// script, which validates every source record first.
const FOODS = rawFoods as unknown as BuiltCatalogFood[];

const FOODS_BY_ID = new Map(FOODS.map((food) => [food.id, food]));

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Lowercase, strip diacritics and fold `đ → d`, so "bun bo hue" matches
 * "bún bò Huế". The build script folds names and aliases the same way.
 */
export function foldVi(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

export interface SearchCatalogOptions {
  limit?: number;
  /** Catalog ids the user has logged before — nudged up the results. */
  recentIds?: string[];
}

const SCORE = {
  exactName: 100,
  namePrefix: 60,
  nameContains: 40,
  aliasOnly: 25,
  recent: 15,
  trustedSource: 5,
} as const;

/** Label facts and institute figures rank above recipe estimates. */
const TRUSTED_SOURCES = new Set(['label', 'nin']);

function baseScore(food: BuiltCatalogFood, tokens: string[], folded: string): number {
  const everyTokenHits = tokens.every(
    (token) =>
      food.nameFold.includes(token) ||
      food.aliasesFold.some((alias) => alias.includes(token)),
  );

  if (!everyTokenHits) return 0;

  if (food.nameFold === folded) return SCORE.exactName;
  if (food.nameFold.startsWith(folded)) return SCORE.namePrefix;
  if (food.nameFold.includes(folded)) return SCORE.nameContains;

  return SCORE.aliasOnly;
}

/**
 * Folded multi-token search over the bundled list.
 *
 * Every whitespace-separated token in the folded query must match the folded
 * name or one of the folded aliases; matches are then scored (exact name >
 * prefix > contains > alias-only), boosted for recents and trusted sources,
 * sorted descending and sliced to `limit`.
 */
export function searchCatalog(
  query: string,
  { limit = 25, recentIds }: SearchCatalogOptions = {},
): CatalogFood[] {
  const folded = foldVi(query).trim();
  if (folded.length === 0) return [];

  const tokens = folded.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const recent = recentIds && recentIds.length > 0 ? new Set(recentIds) : undefined;

  const scored: { food: BuiltCatalogFood; score: number }[] = [];

  for (const food of FOODS) {
    let score = baseScore(food, tokens, folded);
    if (score === 0) continue;

    if (recent?.has(food.id)) score += SCORE.recent;
    if (TRUSTED_SOURCES.has(food.source)) score += SCORE.trustedSource;

    scored.push({ food, score });
  }

  scored.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));

  return scored.slice(0, limit).map((entry) => entry.food);
}

export function getCatalogFood(id: string): CatalogFood | undefined {
  return FOODS_BY_ID.get(id);
}
