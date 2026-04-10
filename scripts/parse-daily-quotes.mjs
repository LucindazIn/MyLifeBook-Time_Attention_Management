/**
 * Parses scripts/dailyQuotesRaw.txt into src/lib/dailyQuotePools.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(__dirname, 'dailyQuotesRaw.txt');
const outPath = path.join(__dirname, '../src/lib/dailyQuotePools.json');

const raw = fs.readFileSync(rawPath, 'utf8');
const quotes = [];

const blocks = raw.split(/(?=^\s*\d+\.\s+[^\n]+\([^)]+\))/m);

for (const block of blocks) {
  const trimmed = block.trim();
  if (!trimmed) continue;

  const head = trimmed.match(/^\s*(\d+)\.\s*(.+?)\s*\(([^)]+)\)/m);
  if (!head) continue;

  const authorZh = head[2].trim();
  const authorEn = head[3].trim();

  const afterHead = trimmed.slice(trimmed.indexOf('\n') + 1);
  const start = afterHead.indexOf('"');
  if (start < 0) continue;

  let en = '';
  let zh = '';
  let pos = start + 1;
  while (pos < afterHead.length) {
    const endPos = afterHead.indexOf('"', pos);
    if (endPos < 0) break;
    const afterQ = afterHead.slice(endPos + 1);
    const zhMatch = afterQ.match(/^\s*\r?\n+\s*([^\r\n]+)/);
    if (zhMatch && /[\u3000-\u9fff\u4e00-\u9fff]/.test(zhMatch[1])) {
      en = afterHead
        .slice(start + 1, endPos)
        .replace(/\s+/g, ' ')
        .trim();
      zh = zhMatch[1].trim();
      break;
    }
    pos = endPos + 1;
  }

  if (en && zh) {
    quotes.push({ en, zh, authorEn, authorZh });
  }
}

fs.writeFileSync(outPath, JSON.stringify({ quotes }, null, 0) + '\n', 'utf8');
console.error(`Parsed ${quotes.length} quotes -> ${outPath}`);
