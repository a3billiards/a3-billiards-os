import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_STORAGE_KEY,
  USER_LANGUAGE_STORAGE_KEY,
  type AppLocale,
} from "./config";

export async function readStoredLocale(): Promise<AppLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_LANGUAGE_STORAGE_KEY);
    if (raw && isAppLocale(raw)) return raw;
  } catch {
    // best-effort
  }
  // Backward-compat: old builds stored language in SecureStore.
  try {
    const legacy = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    if (legacy && isAppLocale(legacy)) return legacy;
  } catch {
    // best-effort
  }
  return null;
}

export async function writeStoredLocale(locale: AppLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_LANGUAGE_STORAGE_KEY, locale);
  } catch {
    // best-effort
  }
}

export async function clearStoredLocale(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_LANGUAGE_STORAGE_KEY);
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
