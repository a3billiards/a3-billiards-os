import { DEFAULT_LOCALE, resolveDeviceLocale } from "./config";

type LocaleInfo = {
  languageTag?: string;
  languageCode?: string;
};

let localizationModule: typeof import("expo-localization") | null | undefined;

function getLocalizationModule(): typeof import("expo-localization") | null {
  if (localizationModule !== undefined) return localizationModule;
  try {
    // Lazy require — dev clients built before expo-localization was added lack the native module.
    const mod = require("expo-localization") as typeof import("expo-localization");
    // require() can succeed while the native module is still missing on old dev APKs.
    mod.getLocales();
    localizationModule = mod;
  } catch {
    localizationModule = null;
  }
  return localizationModule;
}

export function readDeviceLocales(): LocaleInfo[] {
  const mod = getLocalizationModule();
  if (!mod) return [];
  try {
    return mod.getLocales().map((loc) => ({
      languageTag: loc.languageTag ?? undefined,
      languageCode: loc.languageCode ?? undefined,
    }));
  } catch {
    return [];
  }
}

export function readDeviceLocale() {
  const locales = readDeviceLocales();
  if (locales.length === 0) return DEFAULT_LOCALE;
  return resolveDeviceLocale(locales);
}
