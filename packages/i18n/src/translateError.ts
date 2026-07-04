import type { TFunction } from "i18next";
import type { ErrorMessageKey } from "./locales/errors";
import { ensureI18nInitialized } from "./i18n";

/** Translate a Convex error code (e.g. AUTH_001) to the user's locale. */
export function translateErrorCode(
  code: string,
  t?: TFunction,
): string {
  const i18n = ensureI18nInitialized();
  const translate = t ?? i18n.t.bind(i18n);
  const key = `errors.${code}` as const;
  const translated = translate(key, { defaultValue: "" });
  if (translated && translated !== key) return translated;
  if (code in (i18n.getResourceBundle("en", "translation")?.errors ?? {})) {
    return translate(key, { lng: "en" });
  }
  return translate("errors.UNKNOWN");
}

export function translateConvexErrorMessage(
  error: Error,
  t?: TFunction,
): string {
  const match = error.message.match(/([A-Z_]+(?:_\d{3,}|_NEW_USER)):\s*([^\n]+)/);
  if (!match) return error.message;
  const [, code] = match;
  return translateErrorCode(code as ErrorMessageKey | string, t);
}
