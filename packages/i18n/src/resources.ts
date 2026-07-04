import en from "../locales/en.json";
import ar from "../locales/ar.json";
import hi from "../locales/hi.json";
import kn from "../locales/kn.json";
import ml from "../locales/ml.json";
import te from "../locales/te.json";
import ta from "../locales/ta.json";
import fr from "../locales/fr.json";
import nl from "../locales/nl.json";

/** Single source of truth: JSON locale files under packages/i18n/locales/ */
export const translationResources = {
  en: { translation: en },
  ar: { translation: ar },
  hi: { translation: hi },
  kn: { translation: kn },
  ml: { translation: ml },
  te: { translation: te },
  ta: { translation: ta },
  fr: { translation: fr },
  nl: { translation: nl },
} as const;
