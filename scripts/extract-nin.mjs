// @ts-check
/**
 * One-off extraction of the Vietnamese Food Composition Table 2007 (NIN) PDF
 * into `data/catalog/sources/nin-2007.json`.
 *
 * Usage: node scripts/extract-nin.mjs <path-to-pdf>
 *
 * Every page is one food. The nutrient labels in the left column are
 * misaligned with their values, but the first eight left-column
 * `<unit> <value> [<source>]` triples are always, in order: water, energy kcal,
 * energy kJ, protein, fat, carbohydrate, fiber, ash. The right half of each
 * line (fatty/amino acids) is cut off by column position. A `-` (not measured)
 * becomes null, never 0. Nothing is estimated: unparseable values are reported,
 * not filled.
 *
 * The Vietnamese name is TCVN3 (ABC, .VnArial / .VnArialH) legacy-font text that
 * pdftotext drops letters from (a-grave, u-horn), so the raw glyph codes are read
 * with PyMuPDF (python + pymupdf must be installed; override the interpreter with
 * PYTHON). PyMuPDF reports TCVN3 byte 0xB5 as U+03BC and 0xAD as U+2212; both are
 * folded back before decoding. The .VnArialH font only draws capitals, the codes
 * are the same, so names are lowercased and the first letter capitalised.
 *
 * Prints a validation report (counts, duplicates, missing macros, Atwater and
 * kJ cross-checks) and writes the JSON sorted by code.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pdf = process.argv[2];
if (!pdf) {
  console.error('usage: node scripts/extract-nin.mjs <path-to-pdf>');
  process.exit(1);
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../data/catalog/sources/nin-2007.json');
const text = execFileSync('pdftotext', ['-layout', '-enc', 'Latin1', pdf, '-'], {
  encoding: 'latin1',
  maxBuffer: 1 << 28,
});

const PY = `
import json, sys
import pymupdf
out = {}
for i, page in enumerate(pymupdf.open(sys.argv[1])):
    spans = [s for b in page.get_text('dict')['blocks'] for l in b.get('lines', []) for s in l['spans']]
    vi = next((s for s in spans if 'ietnamese' in s['text']), None)
    en = next((s for s in spans if '(English)' in s['text']), None)
    if not vi or not en:
        continue
    top, bottom, left = vi['bbox'][1] - 3, en['bbox'][1] - 3, vi['bbox'][2]
    name = sorted((s for s in spans if top <= s['bbox'][1] < bottom and left <= s['bbox'][0] < 450), key=lambda s: (round(s['bbox'][1]), s['bbox'][0]))
    out[i + 1] = ''.join(s['text'] for s in name)
json.dump(out, sys.stdout)
`;

const TCVN3 = new Map();
[
  [0xa1, 'ĂÂÊÔƠƯĐăâêôơưđ'],
  [0xb5, 'àảãáạ'],
  [0xbb, 'ằẳẵắ'],
  [0xc6, 'ặầẩẫấậ'],
  [0xcc, 'è'],
  [0xce, 'ẻẽéẹềểễếệìỉ'],
  [0xdc, 'ĩíị'],
  [0xdf, 'ò'],
  [0xe1, 'ỏõóọồổỗốộờởỡớợ'],
  [0xef, 'ù'],
  [0xf1, 'ủũúụừửữứựỳỷỹýỵ'],
].forEach(([from, chars]) => [...chars].forEach((c, k) => TCVN3.set(from + k, c)));

function decodeTcvn3(raw) {
  let out = '';
  for (const ch of raw) {
    const cp = ch.codePointAt(0);
    const byte = cp === 0x3bc ? 0xb5 : cp === 0x2212 ? 0xad : cp;
    const mapped = byte < 0x80 ? ch : TCVN3.get(byte);
    if (mapped === undefined) return null;
    out += mapped;
  }
  const name = out.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  return name ? name[0].toLocaleUpperCase('vi') + name.slice(1) : null;
}

const names = JSON.parse(
  execFileSync(process.env.PYTHON ?? 'python', ['-W', 'ignore', '-c', PY, pdf], { encoding: 'utf8', maxBuffer: 1 << 28 }),
);

const FIELDS = ['waterG', 'kcal', 'kj', 'proteinG', 'fatG', 'carbsG', 'fiberG', 'ashG'];
const UNITS = ['g', 'kcal', 'kj', 'g', 'g', 'g', 'g', 'g'];
const TRIPLE = /^\s*(g|mg|kcal|kj)\s+(-|\d+(?:[.,]\d+)?)(?:\s+\d)?(?:\s|$)/i;

const foods = [];
const problems = [];

text.split('\f').forEach((page, i) => {
  const stt = page.match(/STT:\s*(\d+)/);
  const en = page.match(/\(English\):\s*(.*?)\s{2,}\S*\s+s\S*:\s*(\d+)/);
  if (!stt || !en) return;
  const where = `page ${i + 1} STT ${stt[1]}`;
  const lines = page.split('\n');
  const units = lines.filter((l) => l.includes('(Unit)'))[0];
  if (!units) return problems.push(`${where}: no unit header`);
  const left = units.indexOf('(Unit)');
  const right = units.indexOf('(Unit)', left + 1);

  const triples = [];
  for (const line of lines) {
    if (line.includes('(Unit)') || line.includes('(English)')) continue;
    const m = TRIPLE.exec(line.slice(left - 2, right - 25));
    if (m) triples.push({ unit: m[1].toLowerCase(), raw: m[2] });
    if (triples.length === 8) break;
  }
  if (triples.length < 8) return problems.push(`${where}: only ${triples.length} left-column values`);
  const badUnit = triples.findIndex((t, k) => t.unit !== UNITS[k]);
  if (badUnit >= 0) return problems.push(`${where}: unit sequence ${triples.map((t) => t.unit).join(',')}`);

  const per100g = Object.fromEntries(
    FIELDS.map((f, k) => [f, triples[k].raw === '-' ? null : Number(triples[k].raw.replace(',', '.'))]),
  );
  const waste = page.match(/\(%\):\s*(-|\d+(?:[.,]\d+)?)/);
  foods.push({
    code: en[2],
    stt: Number(stt[1]),
    page: i + 1,
    nameEn: en[1].trim(),
    nameVi: names[i + 1] === undefined ? null : decodeTcvn3(names[i + 1]),
    wastePct: waste && waste[1] !== '-' ? Number(waste[1].replace(',', '.')) : null,
    per100g,
  });
});

foods.sort((a, b) => Number(a.code) - Number(b.code));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(foods, null, 2) + '\n');

const row = (f) => `${f.code} p${f.page} ${JSON.stringify(f.per100g)}`;
const seen = new Map();
for (const f of foods) seen.set(f.code, [...(seen.get(f.code) ?? []), f.page]);
const dupes = [...seen].filter(([, pages]) => pages.length > 1);
const missing = foods.filter(({ per100g: p }) => [p.kcal, p.proteinG, p.fatG, p.carbsG].some((v) => v === null));
const complete = foods.filter((f) => !missing.includes(f));
const atwater = complete.filter(({ per100g: p }) => {
  const calc = 4 * p.proteinG + 9 * p.fatG + 4 * p.carbsG;
  return Math.abs(p.kcal - calc) > Math.max(10, 0.1 * p.kcal);
});
const kj = foods.filter(({ per100g: p }) => p.kcal !== null && p.kj !== null && Math.abs(p.kj - p.kcal * 4.184) > 0.05 * p.kj);

console.log(`foods parsed: ${foods.length} -> ${out}`);
console.log(`unparsed pages: ${problems.length}`);
problems.forEach((p) => console.log(`  ${p}`));
const noVi = foods.filter((f) => f.nameVi === null);
console.log(`nameVi decoded: ${foods.length - noVi.length}, null: ${noVi.length}`);
noVi.forEach((f) => console.log(`  ${f.code} p${f.page} ${f.nameEn}`));
console.log(`duplicate codes: ${dupes.length}`);
dupes.forEach(([c, p]) => console.log(`  ${c} pages ${p.join(',')}`));
console.log(`missing kcal/protein/fat/carbs: ${missing.length}`);
missing.forEach((f) => console.log(`  ${row(f)}`));
console.log(`atwater flags: ${atwater.length}`);
atwater.forEach((f) => console.log(`  ${row(f)}`));
console.log(`kJ flags: ${kj.length}`);
kj.forEach((f) => console.log(`  ${row(f)}`));
