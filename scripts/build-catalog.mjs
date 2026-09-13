// @ts-check
/**
 * Builds the bundled food catalog.
 *
 * Reads the two hand-authored source files, validates every record, assigns a
 * stable slug `id` (folded name, `-2`/`-3` suffix on collision) plus serving
 * ids, adds folded name/alias fields for diacritic- and d-insensitive search,
 * merges, sorts by category then name, and writes the committed
 * `src/data/catalog/foods.json`. Plain Node - no dependencies, no SQLite.
 *
 * @typedef {import('../src/data/catalog/record.ts').CatalogSourceRecord} CatalogSourceRecord
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);

const SOURCE_FILES = ['curated-vn.json', 'generic-foods.json'];
const OUT_PATH = fileURLToPath(new URL('src/data/catalog/foods.json', projectRoot));

const VALID_SOURCES = new Set(['label', 'nin', 'recipe-estimate', 'chain', 'generic']);

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

function validate(record, where) {
  const bad = (msg) => errors.push(`${where}: ${msg}`);

  if (typeof record.name !== 'string' || record.name.trim() === '') bad('name is missing');
  if (!Array.isArray(record.aliases) || record.aliases.some((a) => typeof a !== 'string'))
    bad('aliases must be an array of strings');
  if (typeof record.category !== 'string' || record.category === '') bad('category is missing');
  if (!VALID_SOURCES.has(record.source)) bad(`source "${record.source}" is not recognised`);

  const p = record.per100g;
  if (!p || typeof p !== 'object') {
    bad('per100g is missing');
  } else {
    for (const key of ['kcal', 'carbsG', 'proteinG', 'fatG']) {
      if (typeof p[key] !== 'number' || Number.isNaN(p[key])) bad(`per100g.${key} is not a number`);
    }
    if (p.fiberG != null && typeof p.fiberG !== 'number') bad('per100g.fiberG is not a number');
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
}

/** @type {CatalogSourceRecord[]} */
const rawRecords = [];

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
    validate(record, `${file}[${index}] (${record?.name ?? '?'})`);
    rawRecords.push(record);
  });
}

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

const foods = rawRecords.map((record) => {
  const id = assignId(record.name);

  return {
    id,
    name: record.name,
    aliases: record.aliases,
    category: record.category,
    source: record.source,
    per100g: {
      kcal: record.per100g.kcal,
      carbsG: record.per100g.carbsG,
      proteinG: record.per100g.proteinG,
      fatG: record.per100g.fatG,
      ...(record.per100g.fiberG != null ? { fiberG: record.per100g.fiberG } : {}),
    },
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
