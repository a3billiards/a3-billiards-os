/**
 * Deep-merge gap translation patches into locale JSON files.
 * Patches: locales/_merge/gap-translations/{lang}.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "locales");
const patchDir = join(localesDir, "_merge", "gap-translations");
const LOCALES = ["ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"];

function deepMergeOverwrite(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (
        target[key] === undefined ||
        target[key] === null ||
        typeof target[key] !== "object" ||
        Array.isArray(target[key])
      ) {
        target[key] = {};
      }
      deepMergeOverwrite(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

for (const locale of LOCALES) {
  const patchPath = join(patchDir, `${locale}.json`);
  if (!existsSync(patchPath)) {
    console.log(`Skip ${locale}: no patch file`);
    continue;
  }
  const bundle = JSON.parse(readFileSync(join(localesDir, `${locale}.json`), "utf8"));
  const patch = JSON.parse(readFileSync(patchPath, "utf8"));
  deepMergeOverwrite(bundle, patch);
  writeFileSync(join(localesDir, `${locale}.json`), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(`Applied patch to ${locale}.json`);
}
