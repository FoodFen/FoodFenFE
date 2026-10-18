// @ts-check
/**
 * One-off extraction of the USDA FoodData Central SR Legacy CSV release
 * (public domain / CC0) into `data/catalog/sources/usda-sr-legacy.json`.
 *
 * Usage: node scripts/extract-usda.mjs <dir-with-unzipped-csvs>
 *
 * Reads food.csv, sr_legacy_food.csv, food_nutrient.csv, nutrient.csv and
 * food_category.csv. SR Legacy amounts are per 100 g. A nutrient row that is
 * absent becomes null, never 0. Nothing is estimated or corrected.
 * Prints a validation report (counts, duplicates, missing fields, Atwater check).
 */
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/extract-usda.mjs <dir-with-unzipped-csvs>');
  process.exit(1);
}

/** @param {string} text */
function parseCsv(text) {
  /** @type {string[][]} */
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** @param {string} name */
function readTable(name) {
  const path = join(dir, `${name}.csv`);
  if (!existsSync(path)) return null;
  const [header, ...rows] = parseCsv(readFileSync(path, 'utf8').replace(/^﻿/, ''));
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** @param {string} name */
function requireTable(name) {
  const t = readTable(name);
  if (!t) throw new Error(`Missing ${name}.csv in ${dir}`);
  return t;
}

const WANTED = /** @type {const} */ ({
  1008: { key: 'kcal', name: 'Energy', unit: 'KCAL' },
  1003: { key: 'proteinG', name: 'Protein', unit: 'G' },
  1004: { key: 'fatG', name: 'Total lipid (fat)', unit: 'G' },
  1005: { key: 'carbsG', name: 'Carbohydrate, by difference', unit: 'G' },
  1079: { key: 'fiberG', name: 'Fiber, total dietary', unit: 'G' },
  1051: { key: 'waterG', name: 'Water', unit: 'G' },
});

const nutrients = new Map(requireTable('nutrient').map((n) => [n.id, n]));
for (const [id, w] of Object.entries(WANTED)) {
  const n = nutrients.get(id);
  if (!n || n.name !== w.name || n.unit_name !== w.unit) {
    console.error(`Nutrient ${id} mismatch: expected ${w.name} (${w.unit}), got ${n ? `${n.name} (${n.unit_name})` : 'nothing'}`);
    process.exit(1);
  }
}

const categories = new Map((readTable('food_category') ?? []).map((c) => [c.id, c.description]));
const ndb = new Map(requireTable('sr_legacy_food').map((r) => [r.fdc_id, r.NDB_number]));
const foods = requireTable('food').filter((f) => f.data_type === 'sr_legacy_food');

/** @type {Map<string, Record<string, number | null>>} */
const values = new Map();
let duplicateNutrientRows = 0;
for (const r of requireTable('food_nutrient')) {
  const w = WANTED[/** @type {keyof typeof WANTED} */ (r.nutrient_id)];
  if (!w || r.amount === '') continue;
  const v = values.get(r.fdc_id) ?? {};
  if (w.key in v) duplicateNutrientRows++;
  v[w.key] = Number(r.amount);
  values.set(r.fdc_id, v);
}

const fields = ['kcal', 'proteinG', 'fatG', 'carbsG', 'fiberG', 'waterG'];
const entries = foods
  .map((f) => {
    const v = values.get(f.fdc_id) ?? {};
    return {
      fdcId: f.fdc_id,
      ndbNumber: ndb.get(f.fdc_id) ?? '',
      description: f.description,
      category: categories.get(f.food_category_id) ?? '',
      per100g: Object.fromEntries(fields.map((k) => [k, v[k] ?? null])),
    };
  })
  .sort((a, b) => Number(a.fdcId) - Number(b.fdcId));

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../data/catalog/sources/usda-sr-legacy.json');
const json = JSON.stringify(entries, null, 1);
writeFileSync(out, json + '\n');

const ids = entries.map((e) => e.fdcId);
const missing = Object.fromEntries(fields.map((k) => [k, entries.filter((e) => e.per100g[k] === null).length]));
// Atwater general factors (4P + 9F + 4C) vs. the stated energy; alcohol, fiber and polyols explain many.
const atwater = entries.filter((e) => {
  const { kcal, proteinG, fatG, carbsG } = e.per100g;
  if (kcal === null || proteinG === null || fatG === null || carbsG === null) return false;
  return Math.abs(kcal - (4 * proteinG + 9 * fatG + 4 * carbsG)) > Math.max(15, 0.15 * kcal);
});

console.log(`Foods: ${entries.length}`);
console.log(`Duplicate fdcIds: ${ids.length - new Set(ids).size}; duplicate nutrient rows: ${duplicateNutrientRows}`);
console.log(`No NDB number: ${entries.filter((e) => !e.ndbNumber).length}; no category: ${entries.filter((e) => !e.category).length}`);
console.log('Missing per field:', missing);
console.log(`Atwater mismatches (> max(15, 15% kcal)): ${atwater.length}. Examples:`);
for (const e of atwater.slice(0, 10)) console.log(`  ${e.fdcId} ${e.description}`, JSON.stringify(e.per100g));
console.log(`Wrote ${out} (${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} MB)`);
