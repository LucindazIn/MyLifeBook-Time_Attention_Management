/**
 * Reads scripts/dayNamePaste.txt (bilingual pairs zh then en), strips headers and
 * meta lines, removes trailing 。/., dedupes pairs, writes zh-*.txt / en-*.txt and
 * runs merge-day-name-pools.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pastePath = path.join(__dirname, 'dayNamePaste.txt');
const fragDir = path.join(root, 'src/lib/dayNameRandomPools/fragments');

function hasCJK(s) {
  return /[\u4e00-\u9fff]/.test(s);
}

function stripZh(s) {
  let t = s.trim();
  t = t.replace(/。+$/u, '');
  t = t.replace(/…+$/u, '');
  return t.trim();
}

function stripEn(s) {
  let t = s.trim();
  t = t.replace(/\.$/, '');
  return t.trim();
}

function shouldSkipLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^[一二三四五]、/.test(t)) return true;
  if (/\|\s*\d+%\s*$/.test(t)) return true;
  if (/^day name列表更新/.test(t)) return true;
  if (/^提醒，/.test(t)) return true;
  if (/^另外，day name/.test(t)) return true;
  if (/^这\s*\d+\s*条/.test(t)) return true;
  if (/涵盖了|去除了|严格遵循|极致简练|意象的捕捉|思维的留白/.test(t)) return true;
  return false;
}

const raw = fs.readFileSync(pastePath, 'utf8');
const lines = raw.split(/\r?\n/);

const content = [];
for (const line of lines) {
  if (shouldSkipLine(line)) continue;
  const t = line.trim();
  if (!t) continue;
  content.push(t);
}

const pairs = [];
for (let i = 0; i + 1 < content.length; i += 2) {
  let a = content[i];
  let b = content[i + 1];
  if (!hasCJK(a) && hasCJK(b)) {
    [a, b] = [b, a];
  }
  if (!hasCJK(a) || hasCJK(b)) {
    console.warn('Unexpected pair at index', i, a, b);
    continue;
  }
  const zh = stripZh(a);
  const en = stripEn(b);
  if (!zh || !en) continue;
  pairs.push({ zh, en });
}

const seenZh = new Set();
const seenEn = new Set();
const out = [];
for (const { zh, en } of pairs) {
  if (seenZh.has(zh) || seenEn.has(en)) continue;
  seenZh.add(zh);
  seenEn.add(en);
  out.push({ zh, en });
}

const zhLines = out.map((p) => p.zh);
const enLines = out.map((p) => p.en);

console.error(`Pairs: ${pairs.length}, unique: ${out.length}`);

const nFiles = 4;
const chunk = Math.ceil(zhLines.length / nFiles);
for (let f = 0; f < nFiles; f++) {
  const start = f * chunk;
  const sliceZh = zhLines.slice(start, start + chunk);
  const sliceEn = enLines.slice(start, start + chunk);
  const zi = String(f + 1).padStart(2, '0');
  fs.writeFileSync(path.join(fragDir, `zh-${zi}.txt`), sliceZh.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(fragDir, `en-${zi}.txt`), sliceEn.join('\n') + '\n', 'utf8');
}

const r = spawnSync(process.execPath, [path.join(__dirname, 'merge-day-name-pools.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
