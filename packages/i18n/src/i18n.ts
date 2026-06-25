import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE } from "./config";
import { translationResources } from "./locales";

let initialized = false;

export function ensureI18nInitialized(): typeof i18n {
  if (!initialized) {
    void i18n.use(initReactI18next).init({
      resources: translationResources,
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      defaultNS: "translation",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
      returnNull: false,
    });
    initialized = true;
  }
  return i18n;
}

export { i18n };
