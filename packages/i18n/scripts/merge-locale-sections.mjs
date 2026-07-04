import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "locales");
const mergeDir = path.join(localesDir, "_merge");
const langs = ["en", "ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"];
const sections = ["notifications", "customerApp", "ownerApp", "sharedUi", "auth", "adminApp"];

const phoneEn = JSON.parse(
  fs.readFileSync(path.join(mergeDir, "auth.en.json"), "utf8"),
).phone;

for (const lang of langs) {
  const filePath = path.join(localesDir, `${lang}.json`);
  const locale = JSON.parse(fs.readFileSync(filePath, "utf8"));

  for (const section of sections) {
    const sectionPath = path.join(mergeDir, `${section}.${lang}.json`);
    if (!fs.existsSync(sectionPath)) {
      console.warn(`Missing ${sectionPath}`);
      continue;
    }
    const sectionData = JSON.parse(fs.readFileSync(sectionPath, "utf8"));
    locale[section] = sectionData;
  }

  if (lang !== "en" && locale.auth && !locale.auth.phone && phoneEn) {
    locale.auth.phone = phoneEn;
  }

  fs.writeFileSync(filePath, JSON.stringify(locale, null, 2) + "\n", "utf8");
  console.log(`Updated ${lang}.json`);
}
