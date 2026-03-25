/**
 * Reads activities.zh.json and writes activities.en.json via MyMemory public API
 * (no key). Adds delays between requests.
 *
 * Usage: node scripts/translate-activities-en.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ZH = path.join(ROOT, "src/data/contentPools/activities.zh.json");
const EN = path.join(ROOT, "src/data/contentPools/activities.en.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mymemory(q) {
  const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=zh-CN|en`;
  const res = await fetch(u);
  const j = await res.json();
  if (j.responseStatus !== 200) throw new Error(j.responseDetails || "translate failed");
  const t = j.responseData?.translatedText;
  if (!t) throw new Error("empty translation");
  if (j.quotaFinished) throw new Error("quota finished");
  return String(t).trim();
}

async function run() {
  const zh = JSON.parse(fs.readFileSync(ZH, "utf8"));
  const items = [];
  for (let i = 0; i < zh.items.length; i++) {
    const x = zh.items[i];
    let title;
    let description;
    let tries = 0;
    while (tries < 5) {
      try {
        title = await mymemory(x.title);
        await sleep(450);
        description = await mymemory(x.description);
        await sleep(450);
        break;
      } catch (e) {
        tries += 1;
        console.warn("retry", i, tries, e.message);
        await sleep(3000 * tries);
      }
    }
    if (!title) throw new Error("failed at " + i);
    items.push({
      ...x,
      title,
      description,
      locale: "en",
    });
    if ((i + 1) % 25 === 0) console.log(i + 1, "/", zh.items.length);
  }
  const out = {
    version: zh.version,
    locale: "en",
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
  fs.writeFileSync(EN, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", EN);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
