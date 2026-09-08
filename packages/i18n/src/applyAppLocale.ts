import { Alert, I18nManager } from "react-native";
import type { i18n as I18nInstance } from "i18next";
import type { AppLocale } from "./config";
import { writeStoredLocale } from "./localeStorage";

async function applyRtl(locale: AppLocale): Promise<void> {
  const nextIsRtl = locale === "ar";
  const prevIsRtl = I18nManager.isRTL;

  // Set the RTL flags. Full layout direction requires an app restart.
  I18nManager.allowRTL(nextIsRtl);
  I18nManager.forceRTL(nextIsRtl);

  if (prevIsRtl !== nextIsRtl) {
    Alert.alert(
      "Please restart the app to apply the layout direction change",
    );
  }
}

/** Change active locale locally (RTL, i18n, secure storage). */
export async function applyAppLocale(
  locale: AppLocale,
  i18n: I18nInstance,
): Promise<void> {
  await applyRtl(locale);
  await i18n.changeLanguage(locale);
  await writeStoredLocale(locale);
}
