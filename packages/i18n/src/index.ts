export {
  APP_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  LOCALE_STORAGE_KEY,
  RTL_LOCALES,
  isAppLocale,
  resolveDeviceLocale,
  type AppLocale,
  type LocaleOption,
} from "./config";
export { ensureI18nInitialized, i18n } from "./i18n";
export { I18nProvider, useAppLocale, useAppLocaleOptional } from "./I18nProvider";
export type { I18nProviderProps } from "./I18nProvider";
export { LanguagePicker } from "./LanguagePicker";
export type { LanguagePickerProps } from "./LanguagePicker";
export { LoginLanguagePicker } from "./LoginLanguagePicker";
export {
  translateConvexErrorMessage,
  translateErrorCode,
} from "./translateError";
export type { ErrorMessageKey } from "./locales/errors";
export { useTranslation } from "react-i18next";
