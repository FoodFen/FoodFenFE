import type { RemoteCatalogFood } from '@/api/schemas';
import type { Locale } from '@/lib/i18n';
import { localData, StorageKeys } from '@/lib/storage';
import type { CatalogFood } from '@/types/models';

import rawCatalog from './catalog/foods.json';
import type { BuiltCatalog, BuiltCatalogFood } from './catalog/record';

/**
 * The food catalog: the bundled list with synced foods merged over it.
 *
 * ~670 Vietnamese-first foods, pulled from the server by
 * `scripts/pull-catalog.mjs` into `./catalog/foods.json` (committed). The app
 * has to be useful the moment it is installed with no network, so the whole
 * list ships in the bundle and search runs in memory. Foods synced from the
 * server (`catalogSync.ts`) replace or add to it by slug; the merged list is
 * rebuilt once per sync that wrote rows, never per search. Picking a food
 * prefills an ingredient's numbers, which are then copied onto the
 * `ingredient` row — the catalog is never consulted when reading history.
 * Products found by barcode scan are kept beside it in local storage and
 * resolve through `getCatalogFood` too.
 */

// foods.json is written to exactly the BuiltCatalog shape by the pull script.
const BUNDLE = rawCatalog as unknown as BuiltCatalog;

export const BUNDLE_SNAPSHOT_AT = BUNDLE.snapshotAt;

let FOODS = BUNDLE.foods;
let FOODS_BY_ID = new Map(FOODS.map((food) => [food.id, food]));

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Lowercase, strip diacritics and fold `đ → d`, so "bun bo hue" matches
 * "bún bò Huế". The pull script folds names and aliases the same way.
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

/** Label facts, institute figures and admin-entered foods rank above recipe estimates. */
const TRUSTED_SOURCES = new Set(['label', 'nin', 'usda', 'team']);

function nameScore(nameFold: string | undefined, folded: string): number {
  if (!nameFold) return 0;
  if (nameFold === folded) return SCORE.exactName;
  if (nameFold.startsWith(folded)) return SCORE.namePrefix;
  if (nameFold.includes(folded)) return SCORE.nameContains;

  return 0;
}

function baseScore(food: BuiltCatalogFood, tokens: string[], folded: string): number {
  const everyTokenHits = tokens.every(
    (token) =>
      food.nameFold.includes(token) ||
      food.nameEnFold?.includes(token) ||
      food.aliasesFold.some((alias) => alias.includes(token)),
  );

  if (!everyTokenHits) return 0;

  return (
    Math.max(nameScore(food.nameFold, folded), nameScore(food.nameEnFold, folded)) ||
    SCORE.aliasOnly
  );
}

/**
 * Folded multi-token search over the merged list; archived foods are skipped.
 *
 * Every whitespace-separated token in the folded query must match the folded
 * name, the folded English name or one of the folded aliases; matches are then
 * scored (exact name > prefix > contains > alias-only), boosted for recents
 * and trusted sources, sorted descending and sliced to `limit`.
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
    if (food.archived) continue;

    let score = baseScore(food, tokens, folded);
    if (score === 0) continue;

    if (recent?.has(food.id)) score += SCORE.recent;
    if (TRUSTED_SOURCES.has(food.source)) score += SCORE.trustedSource;

    scored.push({ food, score });
  }

  scored.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));

  return scored.slice(0, limit).map((entry) => entry.food);
}

function getScannedFoods(): Record<string, CatalogFood> {
  return localData.get<Record<string, CatalogFood>>(StorageKeys.scannedFoods) ?? {};
}

export function getScannedFood(id: string): CatalogFood | undefined {
  return getScannedFoods()[id];
}

export function saveScannedFood(food: CatalogFood): void {
  localData.set(StorageKeys.scannedFoods, { ...getScannedFoods(), [food.id]: food });
}

export function getCatalogFood(id: string): CatalogFood | undefined {
  return FOODS_BY_ID.get(id) ?? getScannedFood(id);
}

const MICROSECONDS = /(\.\d{3})\d+/;

/** The server stamps microseconds; JS engines only agree on milliseconds. */
export function parseServerTime(iso: string): number {
  return Date.parse(iso.replace(MICROSECONDS, '$1'));
}

function sourceRefOf(food: RemoteCatalogFood): string | undefined {
  if (food.sourceKind === 'team') return 'FoodFen team';
  if (food.sourceKind === 'recipe' || food.sourceKind === 'legacy') return undefined;

  return food.sourceRef ?? undefined;
}

function fromRemote(food: RemoteCatalogFood): BuiltCatalogFood {
  const sourceRef = sourceRefOf(food);
  const { fiberG, ...macros } = food.per100g;

  return {
    id: food.slug,
    name: food.name,
    ...(food.nameEn ? { nameEn: food.nameEn, nameEnFold: foldVi(food.nameEn) } : {}),
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
    aliasesFold: food.aliases.map(foldVi),
  };
}

/** Rebuild the in-memory list: the bundle, with synced foods replacing or adding by slug. */
export function applyCatalogOverlay(overlay: RemoteCatalogFood[]): void {
  const merged = new Map(BUNDLE.foods.map((food) => [food.id, food]));
  for (const food of overlay) merged.set(food.slug, fromRemote(food));

  FOODS_BY_ID = merged;
  FOODS = [...merged.values()];
}

/** English when the app is in English and the food has an English name (first letter upper-cased, as the server backfills lowercase), else the Vietnamese name. */
export function foodDisplayName(
  food: Pick<CatalogFood, 'name' | 'nameEn'>,
  locale: Locale,
): string {
  if (locale !== 'en' || !food.nameEn) return food.name;

  return food.nameEn.charAt(0).toUpperCase() + food.nameEn.slice(1);
}
