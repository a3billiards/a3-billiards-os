import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE } from "./config";
import { translationResources } from "./resources";

let initialized = false;

export function ensureI18nInitialized(): typeof i18n {
  if (!initialized) {
    void i18n.use(initReactI18next).init({
      resources: translationResources as any,
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      defaultNS: "translation",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
      returnNull: false,
      react: {
        useSuspense: false,
        bindI18n: "languageChanged",
        bindI18nStore: "added removed",
      },
    });
    initialized = true;
  }
  return i18n;
}

export { i18n };
