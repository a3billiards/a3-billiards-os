import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "locales");
const locales = ["ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"];

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));

function get(obj, parts) {
  let n = obj;
  for (const x of parts) {
    if (!n || typeof n !== "object") return undefined;
    n = n[x];
  }
  return n;
}

function leaves(obj, p = "") {
  const keys = [];
  for (const [kk, v] of Object.entries(obj)) {
    const pp = p ? `${p}.${kk}` : kk;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...leaves(v, pp));
    else keys.push(pp);
  }
  return keys;
}

const enKeys = leaves(en);
const fallbackByLocale = {};
const fallbackKeys = new Set();

for (const loc of locales) {
  const bundle = JSON.parse(readFileSync(join(localesDir, `${loc}.json`), "utf8"));
  let count = 0;
  for (const k of enKeys) {
    const ev = get(en, k.split("."));
    const lv = get(bundle, k.split("."));
    if (typeof ev === "string" && typeof lv === "string" && ev === lv) {
      fallbackKeys.add(k);
      count++;
    }
  }
  fallbackByLocale[loc] = count;
}

console.log("English-identical per locale:", fallbackByLocale);
console.log("Unique keys needing translation:", fallbackKeys.size);

const byPrefix = {};
for (const k of fallbackKeys) {
  const p = k.split(".").slice(0, 3).join(".");
  byPrefix[p] = (byPrefix[p] || 0) + 1;
}
console.log("\nBy prefix (top 30):");
console.log(
  Object.entries(byPrefix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([k, v]) => `  ${v} ${k}`)
    .join("\n"),
);

writeFileSync(join(localesDir, "fallback-keys.txt"), [...fallbackKeys].sort().join("\n"));
console.log(`\nWrote ${fallbackKeys.size} keys to fallback-keys.txt`);
