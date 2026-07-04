import type { AppLocale } from "../../config";
import type { Localized } from "../utils";
import { ownerEn } from "./en";
import { ownerHi } from "./hi";
import { ownerAr } from "./ar";
import { ownerKn } from "./kn";
import { ownerMl } from "./ml";
import { ownerTa } from "./ta";
import { ownerTe } from "./te";
import { ownerFr } from "./fr";
import { ownerNl } from "./nl";

export const ownerByLocale: Record<AppLocale, Localized<typeof ownerEn>> = {
  en: ownerEn,
  hi: ownerHi,
  ar: ownerAr,
  kn: ownerKn,
  ml: ownerMl,
  ta: ownerTa,
  te: ownerTe,
  fr: ownerFr,
  nl: ownerNl,
};
