// @ts-check
/**
 * Builds the bundled food catalog.
 *
 * Reads the two hand-authored source files, validates every record, resolves
 * each record's nutrition from its cited source, assigns a stable slug `id`
 * (folded name, `-2`/`-3` suffix on collision) plus serving ids, adds folded
 * name/alias fields for diacritic- and d-insensitive search, merges, sorts by
 * category then name, and writes the committed `src/data/catalog/foods.json`.
 * Plain Node - no dependencies, no SQLite.
 *
 * Record `source` forms (types in `src/data/catalog/record.ts`):
 *   "nin:<code>" | "usda:<fdcId>"  per100g is copied from data/catalog/sources/
 *   "recipe"                       per100g is summed from the cited `recipe` list
 *   "label"                        hand-entered per100g, cited by `label.url`
 *   legacy (recipe-estimate | generic | chain | label without a `label` object)
 *                                  keeps its own per100g; built only with --allow-legacy
 *
 * @typedef {Record<string, any>} RawRecord parsed JSON of unknown shape; validated in validate()
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);

const SOURCE_FILES = ['curated-vn.json', 'generic-foods.json'];
const OUT_PATH = fileURLToPath(new URL('src/data/catalog/foods.json', projectRoot));

const ALLOW_LEGACY = process.argv.includes('--allow-legacy');
const LEGACY_SOURCES = new Set(['label', 'nin', 'recipe-estimate', 'chain', 'generic']);
const REF_PATTERN = /^(nin|usda):(.+)$/;

const COMBINING_MARKS = /[̀-ͯ]/g;

/** lowercase, strip diacritics, fold d-with-stroke to plain d. */
function foldVi(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

function slugify(folded) {
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** @type {string[]} */
const errors = [];

function loadSource(file) {
  try {
    return JSON.parse(readFileSync(new URL(`data/catalog/sources/${file}`, projectRoot), 'utf8'));
  } catch (error) {
    errors.push(`sources/${file}: could not be read or parsed - ${error.message}`);
    return [];
  }
}

const ninByCode = new Map(loadSource('nin-2007.json').map((e) => [String(e.code), e]));
const usdaById = new Map(loadSource('usda-sr-legacy.json').map((e) => [String(e.fdcId), e]));

function sourceTable(kind) {
  return kind === 'nin' ? ninByCode : usdaById;
}

function classify(record) {
  const match = typeof record.source === 'string' ? REF_PATTERN.exec(record.source) : null;
  if (match) return { kind: match[1], ref: match[2] };
  if (record.source === 'recipe') return { kind: 'recipe' };
  if (record.source === 'label' && record.label) return { kind: 'label' };
  return { kind: 'legacy' };
}

const WATER = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: null };

/**
 * Nutrition of one ingredient ref (`nin:<code>`, `usda:<fdcId>`, `water`), or
 * undefined when it does not resolve. NIN prints "-" for fat on 75 low-fat
 * foods and its kcal already agrees with 4P+4C there, and USDA has no nulls in
 * protein/fat/carbs, so a null macro becomes 0. A null fiber is "unknown" and
 * stays null, never 0.
 */
function nutrientsOf(ref) {
  if (ref === 'water') return WATER;
  const match = typeof ref === 'string' ? REF_PATTERN.exec(ref) : null;
  const p = match && sourceTable(match[1]).get(match[2])?.per100g;
  if (!p || typeof p.kcal !== 'number') return undefined;
  return {
    kcal: p.kcal,
    proteinG: p.proteinG ?? 0,
    fatG: p.fatG ?? 0,
    carbsG: p.carbsG ?? 0,
    fiberG: p.fiberG ?? null,
  };
}

// Rounding: kcal to a whole number, macros and fiber to 1 decimal.
function finish({ kcal, proteinG, fatG, carbsG, fiberG }) {
  const one = (n) => Math.round(n * 10) / 10;

  return {
    kcal: Math.round(kcal),
    carbsG: one(carbsG),
    proteinG: one(proteinG),
    fatG: one(fatG),
    ...(fiberG != null ? { fiberG: one(fiberG) } : {}),
  };
}

function resolveRecipe(record) {
  const yieldGrams = record.yieldGrams ?? record.recipe.reduce((sum, item) => sum + item.grams, 0);
  const total = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: null };

  for (const { ref, grams } of record.recipe) {
    const n = nutrientsOf(ref);
    for (const key of ['kcal', 'proteinG', 'fatG', 'carbsG']) total[key] += (n[key] * grams) / 100;
    if (n.fiberG != null) total.fiberG = (total.fiberG ?? 0) + (n.fiberG * grams) / 100;
  }

  const scale = 100 / yieldGrams;

  return finish({
    kcal: total.kcal * scale,
    proteinG: total.proteinG * scale,
    fatG: total.fatG * scale,
    carbsG: total.carbsG * scale,
    fiberG: total.fiberG == null ? null : total.fiberG * scale,
  });
}

/** Returns the resolved per100g, or undefined when the record has errors. */
function validate(record, where, { kind, ref }) {
  const bad = (msg) => errors.push(`${where}: ${msg}`);
  const before = errors.length;

  if (typeof record.name !== 'string' || record.name.trim() === '') bad('name is missing');
  if (!Array.isArray(record.aliases) || record.aliases.some((a) => typeof a !== 'string'))
    bad('aliases must be an array of strings');
  if (typeof record.category !== 'string' || record.category === '') bad('category is missing');

  if (kind === 'legacy') {
    if (!LEGACY_SOURCES.has(record.source)) bad(`source "${record.source}" is not recognised`);
    else if (!ALLOW_LEGACY)
      bad(`legacy source "${record.source}" - cite nin:<code>, usda:<fdcId>, a recipe or a label`);
  }

  if (kind === 'nin' || kind === 'usda' || kind === 'recipe') {
    if (record.per100g !== undefined) bad(`per100g must not be set on a ${kind} record`);
  }

  if (kind === 'nin' || kind === 'usda') {
    if (!sourceTable(kind).has(ref)) bad(`unknown ${kind} id "${ref}"`);
    else if (nutrientsOf(record.source) === undefined) bad(`${record.source} has no kcal`);
  }

  if (kind === 'recipe') {
    if (!Array.isArray(record.recipe) || record.recipe.length === 0) {
      bad('recipe must be a non-empty array');
    } else {
      for (const item of record.recipe) {
        if (nutrientsOf(item?.ref) === undefined) bad(`recipe ref "${item?.ref}" is unknown`);
        if (typeof item?.grams !== 'number' || !(item.grams > 0))
          bad(`recipe grams for "${item?.ref}" must be greater than 0`);
      }
    }
    if (record.yieldGrams !== undefined && !(typeof record.yieldGrams === 'number' && record.yieldGrams > 0))
      bad('yieldGrams must be greater than 0');
  }

  if (kind === 'label') {
    if (typeof record.label.brand !== 'string' || record.label.brand.trim() === '')
      bad('label.brand is missing');
    if (typeof record.label.url !== 'string' || record.label.url.trim() === '')
      bad('label.url is missing');
  }

  if (kind === 'label' || kind === 'legacy') {
    const p = record.per100g;
    if (!p || typeof p !== 'object') {
      bad('per100g is missing');
    } else {
      for (const key of ['kcal', 'carbsG', 'proteinG', 'fatG']) {
        if (typeof p[key] !== 'number' || Number.isNaN(p[key])) bad(`per100g.${key} is not a number`);
      }
      if (p.fiberG != null && typeof p.fiberG !== 'number') bad('per100g.fiberG is not a number');
    }
  }

  if (!Array.isArray(record.servings) || record.servings.length === 0) {
    bad('servings must be a non-empty array');
  } else {
    let defaults = 0;
    for (const serving of record.servings) {
      if (typeof serving.label !== 'string' || serving.label === '') bad('serving.label is missing');
      if (typeof serving.grams !== 'number' || !(serving.grams > 0))
        bad('serving.grams must be greater than 0');
      if ('default' in serving && typeof serving.default !== 'boolean')
        bad('serving.default must be a boolean');
      if (serving.default === true) defaults += 1;
    }
    if (defaults > 1) bad('more than one serving is marked default');
  }

  if (errors.length > before) return undefined;
  if (kind === 'nin' || kind === 'usda') return finish(nutrientsOf(record.source));
  if (kind === 'recipe') return resolveRecipe(record);

  const p = record.per100g;

  return {
    kcal: p.kcal,
    carbsG: p.carbsG,
    proteinG: p.proteinG,
    fatG: p.fatG,
    ...(p.fiberG != null ? { fiberG: p.fiberG } : {}),
  };
}

/** @type {{ record: RawRecord, kind: string, per100g: any }[]} resolved per100g is a plain number bag */
const rawRecords = [];
let legacyCount = 0;

for (const file of SOURCE_FILES) {
  const url = new URL(`data/catalog/${file}`, projectRoot);
  let parsed;

  try {
    parsed = JSON.parse(readFileSync(url, 'utf8'));
  } catch (error) {
    errors.push(`${file}: could not be read or parsed - ${error.message}`);
    continue;
  }

  if (!Array.isArray(parsed)) {
    errors.push(`${file}: expected a JSON array`);
    continue;
  }

  parsed.forEach((record, index) => {
    const classified = classify(record);
    if (classified.kind === 'legacy') legacyCount += 1;
    const per100g = validate(record, `${file}[${index}] (${record?.name ?? '?'})`, classified);
    rawRecords.push({ record, kind: classified.kind, per100g });
  });
}

console.log(`catalog:build - ${legacyCount} legacy record(s)`);

if (errors.length > 0) {
  console.error(`catalog:build - ${errors.length} validation error(s):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}

const idCounts = new Map();

function assignId(name) {
  const base = slugify(foldVi(name)) || 'food';
  const seen = idCounts.get(base) ?? 0;
  idCounts.set(base, seen + 1);

  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function sourceFields({ record, kind }) {
  if (kind === 'nin' || kind === 'usda') return { source: kind, sourceRef: record.source };
  if (kind === 'label') return { source: 'label', sourceRef: `label:${record.label.brand}` };
  if (kind === 'recipe') return { source: 'recipe' };

  return { source: record.source };
}

const foods = rawRecords.map((entry) => {
  const { record, per100g } = entry;
  const id = assignId(record.name);

  return {
    id,
    name: record.name,
    aliases: record.aliases,
    category: record.category,
    ...sourceFields(entry),
    ...(entry.kind === 'legacy' ? {} : { verified: true }),
    per100g,
    servings: record.servings.map((serving, index) => ({
      id: `${id}-s${index}`,
      label: serving.label,
      grams: serving.grams,
      ...(serving.default === true ? { default: true } : {}),
    })),
    nameFold: foldVi(record.name),
    aliasesFold: record.aliases.map(foldVi),
  };
});

foods.sort(
  (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
);

writeFileSync(OUT_PATH, `${JSON.stringify(foods, null, 2)}\n`, 'utf8');

const byCategory = foods.reduce((acc, food) => {
  acc[food.category] = (acc[food.category] ?? 0) + 1;

  return acc;
}, /** @type {Record<string, number>} */ ({}));

console.log(`catalog:build - ${foods.length} foods -> src/data/catalog/foods.json`);
console.log(
  Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, count]) => `  ${category}: ${count}`)
    .join('\n'),
);
