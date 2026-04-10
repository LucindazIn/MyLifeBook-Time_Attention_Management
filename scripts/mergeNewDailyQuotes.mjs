/**
 * Merges scripts/quoteBatch2026.json into src/lib/dailyQuotePools.json (dedupe by English text)
 * and appends new entries to scripts/dailyQuotesRaw.txt.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const poolsPath = path.join(__dirname, '../src/lib/dailyQuotePools.json');
const rawPath = path.join(__dirname, 'dailyQuotesRaw.txt');
const batchPath = path.join(__dirname, 'quoteBatch2026.json');

function normEn(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
if (!Array.isArray(batch)) throw new Error('quoteBatch2026.json must be a JSON array');

const existing = JSON.parse(fs.readFileSync(poolsPath, 'utf8'));
const quotes = Array.isArray(existing.quotes) ? [...existing.quotes] : [];
const seen = new Set(quotes.map((q) => normEn(q.en)));
const added = [];

for (const q of batch) {
  const k = normEn(q.en);
  if (!k || seen.has(k)) continue;
  seen.add(k);
  quotes.push({
    en: q.en.replace(/\s+/g, ' ').trim(),
    zh: q.zh.replace(/\s+/g, ' ').trim(),
    authorEn: String(q.authorEn).trim(),
    authorZh: String(q.authorZh).trim(),
  });
  added.push(q);
}

fs.writeFileSync(poolsPath, JSON.stringify({ quotes }, null, 0) + '\n', 'utf8');

let raw = fs.readFileSync(rawPath, 'utf8').replace(/\s*$/, '');
let n = 303;
const nums = [...raw.matchAll(/^\s*(\d+)\.\s+/gm)].map((m) => parseInt(m[1], 10));
if (nums.length) n = Math.max(...nums) + 1;

for (const q of added) {
  const safeEn = q.en.replace(/"/g, "'");
  raw += `\n\n${n}. ${q.authorZh} (${q.authorEn}) | 【批次增补】\n\n"${safeEn}"\n${q.zh}\n`;
  n++;
}
fs.writeFileSync(rawPath, raw + (raw.endsWith('\n') ? '' : '\n'), 'utf8');

console.error(
  `Merged: ${added.length} new quotes (skipped ${batch.length - added.length} duplicates). Total: ${quotes.length}`,
);
