import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(root, "..", "locales");
const mergeDir = path.join(localesDir, "_merge");
const langs = ["en", "ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"];

const phoneEn = JSON.parse(fs.readFileSync(path.join(mergeDir, "auth.en.json"), "utf8")).phone;

for (const lang of langs) {
  const mainPath = path.join(localesDir, `${lang}.json`);
  const main = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  main.auth = JSON.parse(fs.readFileSync(path.join(mergeDir, `auth.${lang}.json`), "utf8"));
  main.adminApp = JSON.parse(fs.readFileSync(path.join(mergeDir, `adminApp.${lang}.json`), "utf8"));
  if (lang !== "en" && !main.auth.phone) main.auth.phone = phoneEn;
  fs.writeFileSync(mainPath, JSON.stringify(main, null, 2) + "\n");
  process.stdout.write(`${lang} auth+adminApp patched\n`);
}
