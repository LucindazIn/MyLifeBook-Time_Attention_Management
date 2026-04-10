/**
 * Concatenates src/lib/dayNameRandomPools/fragments/en-*.txt and zh-*.txt
 * into src/lib/dayNameRandomPools.json (run after editing fragment files).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const fragDir = path.join(root, 'src/lib/dayNameRandomPools/fragments');
const outJson = path.join(root, 'src/lib/dayNameRandomPools.json');

function readPool(prefix) {
  const files = fs
    .readdirSync(fragDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.txt'))
    .sort();
  const lines = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(fragDir, f), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (t) lines.push(t);
    }
  }
  return lines;
}

const en = readPool('en-');
const zh = readPool('zh-');
fs.writeFileSync(outJson, JSON.stringify({ en, zh }, null, 0) + '\n', 'utf8');
console.log(`Wrote ${outJson} (${en.length} en, ${zh.length} zh lines)`);
