import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyRtlIfNeeded, isRTL } from "./rtl";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  resolveDeviceLocale,
  USER_LANGUAGE_STORAGE_KEY,
  type AppLocale,
} from "./src/config";
import { readDeviceLocales } from "./src/deviceLocale";
import { ensureI18nInitialized, i18n } from "./src/i18n";

export { ensureI18nInitialized, i18n, isRTL };

export function getCurrentLanguage(): AppLocale {
  ensureI18nInitialized();
  const lng = (i18n.language ?? DEFAULT_LOCALE).toLowerCase();
  const base = lng.split("-")[0] ?? DEFAULT_LOCALE;
  return isAppLocale(base) ? base : DEFAULT_LOCALE;
}

export async function changeLanguage(code: AppLocale): Promise<void> {
  ensureI18nInitialized();
  await applyRtlIfNeeded(code);
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(USER_LANGUAGE_STORAGE_KEY, code);
}

export async function initI18n(): Promise<typeof i18n> {
  ensureI18nInitialized();

  const preferred = await AsyncStorage.getItem(USER_LANGUAGE_STORAGE_KEY);
  if (preferred && isAppLocale(preferred)) {
    await changeLanguage(preferred);
    return i18n;
  }

  const device = resolveDeviceLocale(readDeviceLocales());
  await changeLanguage(device);
  return i18n;
}
