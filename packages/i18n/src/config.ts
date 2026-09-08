/** Supported app locales — English default. */
export const APP_LOCALES = [
  "en",
  "ar",
  "hi",
  "kn",
  "ml",
  "te",
  "ta",
  "fr",
  "nl",
] as const;

/** AsyncStorage / manual preference key (manual choice wins over device locale). */
export const USER_LANGUAGE_STORAGE_KEY = "user_language_preference";

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const RTL_LOCALES = new Set<AppLocale>(["ar"]);

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

/** Map device locale tag (e.g. hi-IN) to supported app locale. */
export function resolveDeviceLocale(
  deviceLocales: ReadonlyArray<{
    languageTag?: string | null;
    languageCode?: string | null;
  }>,
): AppLocale {
  for (const loc of deviceLocales) {
    const tag = (loc.languageTag ?? loc.languageCode ?? "").toLowerCase();
    if (!tag) continue;
    const base = tag.split("-")[0];
    if (isAppLocale(base)) return base;
    if (isAppLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

/** @deprecated Use USER_LANGUAGE_STORAGE_KEY — kept for SecureStore migration reads */
export const LOCALE_STORAGE_KEY = "a3.preferredLocale";

export interface LocaleOption {
  code: AppLocale;
  /** Native name shown in the language picker */
  nativeName: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: "en", nativeName: "English" },
  { code: "ar", nativeName: "العربية" },
  { code: "hi", nativeName: "हिंदी" },
  { code: "kn", nativeName: "ಕನ್ನಡ" },
  { code: "ml", nativeName: "മലയാളം" },
  { code: "te", nativeName: "తెలుగు" },
  { code: "ta", nativeName: "தமிழ்" },
  { code: "fr", nativeName: "Français" },
  { code: "nl", nativeName: "Nederlands" },
];
