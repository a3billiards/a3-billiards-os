import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "locales");
const outDir = join(localesDir, "_merge", "gap-translations");

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const keys = readFileSync(join(localesDir, "fallback-keys.txt"), "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);

function get(obj, parts) {
  let n = obj;
  for (const x of parts) {
    if (!n || typeof n !== "object") return undefined;
    n = n[x];
  }
  return n;
}

function set(obj, parts, value) {
  let n = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!n[parts[i]] || typeof n[parts[i]] !== "object") n[parts[i]] = {};
    n = n[parts[i]];
  }
  n[parts[parts.length - 1]] = value;
}

mkdirSync(outDir, { recursive: true });

const template = {};
for (const k of keys) {
  const v = get(en, k.split("."));
  if (typeof v === "string") set(template, k.split("."), v);
}

writeFileSync(join(outDir, "en-template.json"), JSON.stringify(template, null, 2) + "\n");
writeFileSync(
  join(outDir, "keys.json"),
  JSON.stringify(keys, null, 2) + "\n",
);
console.log(`Wrote ${keys.length} keys to ${outDir}/en-template.json`);
