import { adminEn } from "./en";
import { adminHi } from "./hi";
import { adminAr } from "./ar";
import { adminKn } from "./kn";
import { adminMl } from "./ml";
import { adminTa } from "./ta";
import { adminTe } from "./te";
import { adminFr } from "./fr";
import { adminNl } from "./nl";
import type { AppLocale } from "../../config";
import type { Localized } from "../utils";

export const adminByLocale: Record<AppLocale, Localized<typeof adminEn>> = {
  en: adminEn,
  hi: adminHi,
  ar: adminAr,
  kn: adminKn,
  ml: adminMl,
  ta: adminTa,
  te: adminTe,
  fr: adminFr,
  nl: adminNl,
};
