import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_STORAGE_KEY,
  type AppLocale,
} from "./config";

export async function readStoredLocale(): Promise<AppLocale | null> {
  try {
    const raw = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    if (raw && isAppLocale(raw)) return raw;
  } catch {
    // SecureStore unavailable on web or during tests
  }
  return null;
}

export async function writeStoredLocale(locale: AppLocale): Promise<void> {
  try {
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
  } catch {
    // best-effort
  }
}

export async function clearStoredLocale(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LOCALE_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export function pickInitialLocale(
  stored: AppLocale | null,
  userPreferred: string | null | undefined,
  device: AppLocale,
): AppLocale {
  if (userPreferred && isAppLocale(userPreferred)) return userPreferred;
  if (stored) return stored;
  return device ?? DEFAULT_LOCALE;
}
