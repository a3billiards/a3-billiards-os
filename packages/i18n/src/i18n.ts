import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { APP_LOCALES, DEFAULT_LOCALE } from "./config";
import { translationResources } from "./resources";

let initialized = false;

/** Never surface raw key paths (e.g. ownerApp.settings.title) in the UI. */
function installEnglishFallbackT(instance: typeof i18n): void {
  const baseT = instance.t.bind(instance);
  const patched = ((key: string | string[], options?: Record<string, unknown>) => {
    const result = baseT(key as string, options);
    if (typeof key !== "string" || typeof result !== "string") return result;
    if (result !== key) return result;

    const lng =
      typeof options?.lng === "string"
        ? options.lng.split("-")[0]
        : (instance.language ?? DEFAULT_LOCALE).split("-")[0];
    if (lng === DEFAULT_LOCALE) return result;

    const en = baseT(key, { ...options, lng: DEFAULT_LOCALE });
    return typeof en === "string" && en !== key ? en : result;
  }) as typeof instance.t;
  instance.t = patched;
}

export function ensureI18nInitialized(): typeof i18n {
  if (!initialized) {
    const fallbackLng: Record<string, string[]> = { default: [DEFAULT_LOCALE] };
    for (const locale of APP_LOCALES) {
      if (locale !== DEFAULT_LOCALE) fallbackLng[locale] = [DEFAULT_LOCALE];
    }

    void i18n.use(initReactI18next).init({
      resources: translationResources as any,
      lng: DEFAULT_LOCALE,
      fallbackLng,
      defaultNS: "translation",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
      returnNull: false,
      returnEmptyString: false,
      react: {
        useSuspense: false,
        bindI18n: "languageChanged",
        bindI18nStore: "added removed",
      },
    });
    installEnglishFallbackT(i18n);
    initialized = true;
  }
  return i18n;
}

export { i18n };
