import { customerEn } from "./en";
import { customerHi } from "./hi";
import { customerAr } from "./ar";
import { customerKn } from "./kn";
import { customerMl } from "./ml";
import { customerTa } from "./ta";
import { customerTe } from "./te";
import { customerFr } from "./fr";
import { customerNl } from "./nl";
import type { AppLocale } from "../../config";
import type { Localized } from "../utils";

export const customerByLocale: Record<AppLocale, Localized<typeof customerEn>> = {
  en: customerEn,
  hi: customerHi,
  ar: customerAr,
  kn: customerKn,
  ml: customerMl,
  ta: customerTa,
  te: customerTe,
  fr: customerFr,
  nl: customerNl,
};
