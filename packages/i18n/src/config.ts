/** Supported app locales — English default. */
export const APP_LOCALES = [
  "en",
  "hi",
  "ar",
  "kn",
  "ml",
  "ta",
  "te",
  "fr",
  "de",
] as const;

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

export const LOCALE_STORAGE_KEY = "a3.preferredLocale";

export interface LocaleOption {
  code: AppLocale;
  /** Native name shown in the language picker */
  nativeName: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: "en", nativeName: "English" },
  { code: "hi", nativeName: "हिन्दी" },
  { code: "ar", nativeName: "العربية" },
  { code: "kn", nativeName: "ಕನ್ನಡ" },
  { code: "ml", nativeName: "മലയാളം" },
  { code: "ta", nativeName: "தமிழ்" },
  { code: "te", nativeName: "తెలుగు" },
  { code: "fr", nativeName: "Français" },
  { code: "de", nativeName: "Deutsch" },
];
