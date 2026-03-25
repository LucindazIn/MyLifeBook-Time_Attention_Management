/**
 * Reads scripts/data/activities.raw.txt (comma-separated objects or JSON array),
 * fixes common issues from copy-paste, validates, dedupes by title, writes
 * src/data/contentPools/activities.zh.json
 *
 * Usage: node scripts/normalize-activity-catalog.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW = path.join(__dirname, "data", "activities.raw.txt");
const OUT = path.join(ROOT, "src/data/contentPools/activities.zh.json");

const VALID_MODES = new Set(["productive", "chill", "both"]);
const VALID_INTENSITIES = new Set(["high", "low"]);
const VALID_TYPES = new Set(["todo", "meeting", "reminder"]);

function normalizeText(s) {
  let t = s;
  // Strip leaked transcript/HTML closing tags
  t = t.replace(/<\/user_query>\s*$/i, "").trim();
  // Fix `}{` without comma
  t = t.replace(/\}\s*\{/g, "},{");
  // Lines that are only `[` or `]` (split arrays from merged pastes)
  t = t.replace(/^\s*\[\s*$/gm, "");
  t = t.replace(/^\s*\]\s*$/gm, "");
  // Fix `}{` again after line removal
  t = t.replace(/\}\s*\{/g, "},{");
  // Wrap in array
  if (!t.startsWith("[")) t = "[" + t + "]";
  // Trailing comma before ]
  t = t.replace(/,(\s*)\]/g, "$1]");
  return t;
}

/** Fix lines where the whole value uses U+201C…U+201D with no ASCII " after colon (invalid JSON). */
function fixCurlyJsonDelimiters(t) {
  const lines = t.split("\n");
  const out = lines.map((line) => {
    const tr = line.trimStart();
    // Pattern: "title": "笔记整理",  where quotes around value are U+201C/U+201D only
    // Title: "title": "foo" where open is U+201C and close is ASCII " (sometimes U+201D)
    if (tr.startsWith('"title":') && /^"title":\s*\u201c/.test(tr)) {
      let m = line.match(/^(\s*"title":\s*)\u201c([^"]*?)"(\s*,\s*)$/);
      if (m) return `${m[1]}"${m[2].replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"${m[3]}`;
      m = line.match(/^(\s*"title":\s*)\u201c([^\u201d]*)\u201d(\s*,\s*)$/);
      if (m) return `${m[1]}"${m[2].replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"${m[3]}`;
    }
    if (tr.startsWith('"description":') && /^"description":\s*\u201c/.test(tr)) {
      let m = line.match(/^(\s*"description":\s*)\u201c([^"]*?)"(\s*,\s*)$/);
      if (m) return `${m[1]}"${m[2].replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"${m[3]}`;
      m = line.match(/^(\s*"description":\s*)\u201c([^\u201d]*)\u201d(\s*,\s*)$/);
      if (m) return `${m[1]}"${m[2].replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"${m[3]}`;
    }
    // "title": "傍晚看夕阳" + U+201D + ,  (curly close instead of ASCII " before comma)
    if (tr.startsWith('"title":') && /\u201d\s*,\s*$/.test(line)) {
      line = line.replace(/\u201d(\s*,\s*)$/, '"$1');
    }
    // Broken: "title": "和孩子学校老师沟通,  (empty pair U+201C U+201D then text)
    if (tr.startsWith('"title":') && /^"title":\s*\u201c\u201d/.test(tr)) {
      const m = line.match(/^(\s*"title":\s*)\u201c\u201d([^,]+),(\s*)$/);
      if (m) return `${m[1]}"${m[2].trim()}",`;
    }
    return line;
  });
  return out.join("\n");
}

function validateItem(o, index) {
  if (!o || typeof o !== "object") throw new Error(`Item ${index}: not object`);
  const title = String(o.title ?? "").trim();
  if (!title) throw new Error(`Item ${index}: empty title`);
  if (!VALID_INTENSITIES.has(o.intensity))
    throw new Error(`Item ${index}: bad intensity ${o.intensity} (${title})`);
  if (!Array.isArray(o.mode_tags) || o.mode_tags.length === 0)
    throw new Error(`Item ${index}: mode_tags (${title})`);
  for (const m of o.mode_tags) {
    if (!VALID_MODES.has(m)) throw new Error(`Item ${index}: bad mode_tag ${m} (${title})`);
  }
  if (!VALID_TYPES.has(o.type)) throw new Error(`Item ${index}: bad type ${o.type} (${title})`);
  const d = Number(o.default_duration_minutes);
  if (!Number.isFinite(d) || d <= 0 || d > 24 * 60)
    throw new Error(`Item ${index}: bad duration (${title})`);
  if (o.locale !== "zh") throw new Error(`Item ${index}: locale must be zh (${title})`);
  return {
    title,
    description: String(o.description ?? "").trim(),
    intensity: o.intensity,
    mode_tags: [...o.mode_tags],
    type: o.type,
    default_duration_minutes: Math.round(d),
    locale: "zh",
  };
}

function main() {
  if (!fs.existsSync(RAW)) {
    console.error("Missing", RAW);
    process.exit(1);
  }
  let raw = fs.readFileSync(RAW, "utf8");
  raw = normalizeText(raw);
  raw = fixCurlyJsonDelimiters(raw);
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    console.error("JSON.parse failed:", e.message);
    // Try dropping last incomplete object if any
    const lastBrace = raw.lastIndexOf("}");
    if (lastBrace > 0) {
      let tryStr = raw.slice(0, lastBrace + 1) + "]";
      if (!tryStr.startsWith("[")) tryStr = "[" + tryStr.slice(1);
      try {
        arr = JSON.parse(tryStr);
        console.warn("Recovered by trimming after last }");
      } catch {
        throw e;
      }
    } else throw e;
  }
  if (!Array.isArray(arr)) throw new Error("Top-level must be array");

  const seen = new Map();
  const items = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      const v = validateItem(arr[i], i);
      const key = v.title;
      if (seen.has(key)) continue;
      seen.set(key, true);
      items.push(v);
    } catch (err) {
      console.warn("Skip item", i, err.message);
    }
  }

  // Fix known bad entries from source (empty title)
  const filtered = items.filter((x) => x.title.length > 0);

  const payload = {
    version: 1,
    locale: "zh",
    generatedAt: new Date().toISOString(),
    count: filtered.length,
    items: filtered,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", OUT, "items:", filtered.length);
}

main();
