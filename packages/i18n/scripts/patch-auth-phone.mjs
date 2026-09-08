import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(root, "..", "locales");

const phoneByLang = {
  ar: { countryCode: "رمز الدولة", selectCountry: "اختر الدولة", number: "رقم الهاتف" },
  hi: { countryCode: "देश कोड", selectCountry: "देश चुनें", number: "फ़ोन नंबर" },
  kn: { countryCode: "ದೇಶ ಕೋಡ್", selectCountry: "ದೇಶ ಆಯ್ಕೆಮಾಡಿ", number: "ಫೋನ್ ಸಂಖ್ಯೆ" },
  ml: { countryCode: "രാജ്യ കോഡ്", selectCountry: "രാജ്യം തിരഞ്ഞെടുക്കുക", number: "ഫോൺ നമ്പർ" },
  te: { countryCode: "దేశ కోడ్", selectCountry: "దేశం ఎంచుకోండి", number: "ఫోన్ నంబర్" },
  ta: { countryCode: "நாட்டுக் குறியீடு", selectCountry: "நாட்டைத் தேர்ந்தெடுக்கவும்", number: "தொலைபேசி எண்" },
  fr: { countryCode: "Indicatif pays", selectCountry: "Choisir le pays", number: "Numéro de téléphone" },
  nl: { countryCode: "Landcode", selectCountry: "Land selecteren", number: "Telefoonnummer" },
};

for (const [lang, phone] of Object.entries(phoneByLang)) {
  const mainPath = path.join(localesDir, `${lang}.json`);
  const main = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  if (main.auth) main.auth.phone = phone;
  fs.writeFileSync(mainPath, JSON.stringify(main, null, 2) + "\n");
  console.log(`phone patched: ${lang}`);
}
