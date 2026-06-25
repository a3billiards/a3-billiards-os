import { ar } from "./ar";
import { de } from "./de";
import { en } from "./en";
import { fr } from "./fr";
import { hi } from "./hi";
import { kn } from "./kn";
import { ml } from "./ml";
import { ta } from "./ta";
import { te } from "./te";

export const translationResources = {
  en: { translation: en },
  hi: { translation: hi },
  ar: { translation: ar },
  kn: { translation: kn },
  ml: { translation: ml },
  ta: { translation: ta },
  te: { translation: te },
  fr: { translation: fr },
  de: { translation: de },
} as const;

export { en, hi, ar, kn, ml, ta, te, fr, de };
