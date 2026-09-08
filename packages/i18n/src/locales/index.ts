import { ar } from "./ar";
import { nl } from "./nl";
import { en } from "./en";
import { fr } from "./fr";
import { hi } from "./hi";
import { kn } from "./kn";
import { ml } from "./ml";
import { ta } from "./ta";
import { te } from "./te";
import { ownerByLocale } from "./owner";
import { customerByLocale } from "./customer";
import { adminByLocale } from "./admin";
import type { AppLocale } from "../config";
import type { TranslationBundle } from "./types";

function bundle(locale: AppLocale, base: TranslationBundle) {
  return {
    translation: {
      ...en,
      ...base,
      errors: base.errors ?? en.errors,
      owner: ownerByLocale[locale],
      customer: customerByLocale[locale],
      admin: adminByLocale[locale],
    },
  };
}

export const translationResources = {
  en: bundle("en", en),
  hi: bundle("hi", hi),
  ar: bundle("ar", ar),
  kn: bundle("kn", kn),
  ml: bundle("ml", ml),
  ta: bundle("ta", ta),
  te: bundle("te", te),
  fr: bundle("fr", fr),
  nl: bundle("nl", nl),
} as const;

export { en, hi, ar, kn, ml, ta, te, fr, nl };
