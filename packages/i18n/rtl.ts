import { Alert, I18nManager } from "react-native";
import type { AppLocale } from "./src/config";

export function isRTL(code: string): boolean {
  return code === "ar";
}

/**
 * Applies RTL flags for Arabic. React Native requires an app restart for the full
 * layout mirroring effect; we show an explicit restart alert when switching to/from Arabic.
 */
export async function applyRtlIfNeeded(next: AppLocale): Promise<void> {
  const nextIsRtl = isRTL(next);
  const prevIsRtl = I18nManager.isRTL;

  I18nManager.allowRTL(nextIsRtl);
  I18nManager.forceRTL(nextIsRtl);

  if (prevIsRtl !== nextIsRtl) {
    Alert.alert("Please restart the app to apply the layout direction change");
  }
}

