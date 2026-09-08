/**
 * Overwrites locale JSON sections with values from legacy TS bundles.
 * Use after migrate-ts-to-json when audit-gap English blocked TS translations.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ownerEn } from "../src/locales/owner/en";
import { customerEn } from "../src/locales/customer/en";
import { adminEn } from "../src/locales/admin/en";
import { ownerByLocale } from "../src/locales/owner/index";
import { customerByLocale } from "../src/locales/customer/index";
import { adminByLocale } from "../src/locales/admin/index";
import { ar } from "../src/locales/ar";
import { hi } from "../src/locales/hi";
import { kn } from "../src/locales/kn";
import { ml } from "../src/locales/ml";
import { ta } from "../src/locales/ta";
import { te } from "../src/locales/te";
import { fr } from "../src/locales/fr";
import { nl } from "../src/locales/nl";
import { en as sharedEn } from "../src/locales/en";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "locales");

type JsonObject = Record<string, unknown>;
const LOCALES = ["en", "ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"] as const;
type LocaleCode = (typeof LOCALES)[number];
const sharedByLocale = { ar, hi, kn, ml, ta, te, fr, nl } as const;

function deepMergeOverwrite(target: JsonObject, source: JsonObject): void {
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (
        target[key] === undefined ||
        target[key] === null ||
        typeof target[key] !== "object" ||
        Array.isArray(target[key])
      ) {
        target[key] = {};
      }
      deepMergeOverwrite(target[key] as JsonObject, value as JsonObject);
    } else {
      target[key] = value;
    }
  }
}

function buildOwnerAppFromTs(owner: typeof ownerEn): JsonObject {
  return {
    shell: { noClub: owner.noClub, accessDenied: owner.accessDenied },
    home: owner.home,
    slots: owner.slots,
    snacks: owner.snacks,
    financials: owner.financials,
    complaints: owner.complaints,
    bookings: owner.bookings,
    settings: { ...owner.settings, content: owner.settingsContent, passcode: owner.passcode },
    documents: owner.documents,
    kitchen: owner.kitchen,
    livestream: owner.livestream,
    gstReport: {
      financialsGst: {
        disclaimerTitle: owner.financials.gstDisclaimerTitle,
        disclaimerBody: owner.financials.gstDisclaimerBody,
        configureHint: owner.financials.gstConfigureHint,
        invalidRange: owner.financials.gstInvalidRange,
        periodSummary: owner.financials.gstPeriodSummary,
        period: owner.financials.gstPeriod,
        sessionsRealised: owner.financials.gstSessionsRealised,
        gstin: owner.financials.gstin,
        notRegisteredNote: owner.financials.gstNotRegisteredNote,
        taxableRevenue: owner.financials.gstTaxableRevenue,
        tableTimeAfterDiscounts: owner.financials.gstTableTimeAfterDiscounts,
        totalTaxable: owner.financials.gstTotalTaxable,
        outputEstimate: owner.financials.gstOutputEstimate,
        onTableTime: owner.financials.gstOnTableTime,
        onSnacks: owner.financials.gstOnSnacks,
        totalOutput: owner.financials.gstTotalOutput,
        cgst: owner.financials.cgst,
        sgst: owner.financials.sgst,
        igst: owner.financials.igst,
        netPayableEstimate: owner.financials.gstNetPayableEstimate,
        inputTaxCredit: owner.financials.gstInputTaxCredit,
        netPayable: owner.financials.gstNetPayable,
        footnote: owner.financials.gstFootnote,
      },
    },
  };
}

function buildCustomerAppFromTs(customer: typeof customerEn): JsonObject {
  return {
    home: customer.home,
    discovery: customer.discover,
    clubProfile: customer.club,
    booking: customer.book,
    bookingDetail: customer.bookingDetail,
    myBookings: customer.bookings,
    history: customer.history,
    loyalty: { profile: customer.profile },
    live: customer.live,
    profile: customer.profile,
    streaming: customer.streaming,
    screens: customer.screens,
  };
}

function buildAuthFromTs(
  owner: typeof ownerEn,
  customer: typeof customerEn,
  admin: typeof adminEn,
  phone: typeof sharedEn.phone,
): JsonObject {
  return {
    phone,
    admin: { login: admin.login, mfa: admin.mfa, shell: admin.shell },
    customer: {
      login: customer.login,
      register: customer.register,
      verifyPhone: customer.verifyPhone,
      setPassword: customer.setPassword,
      changePassword: customer.changePassword,
      accountBlocked: customer.accountBlocked,
    },
    owner: {
      login: owner.login,
      register: owner.register,
      verifyPhone: owner.verifyPhone,
      changePassword: owner.changePassword,
      changePasscode: owner.changePasscode,
      passcode: owner.passcode,
    },
  };
}

function buildAdminAppFromTs(admin: typeof adminEn): JsonObject {
  return {
    dashboard: admin.dashboard,
    users: admin.users,
    roles: admin.roles,
    complaints: admin.complaints,
    moderation: admin.liveModeration,
    audit: admin.audit,
    notifications: admin.notifications,
    sessions: admin.sessions,
    bookings: admin.bookings,
    userProfile: admin.userProfile,
  };
}

function buildCommonExtrasFromTs(shared: typeof sharedEn): JsonObject {
  return {
    tabs: shared.tabs,
    language: shared.settings,
    config: shared.config,
    subscription: shared.subscription,
    inbox: shared.inbox,
    profile: shared.profile,
    streaming: shared.streaming,
  };
}

function loadBundle(locale: LocaleCode): JsonObject {
  return JSON.parse(readFileSync(join(localesDir, `${locale}.json`), "utf8")) as JsonObject;
}

for (const locale of LOCALES) {
  const bundle = loadBundle(locale);
  const owner = locale === "en" ? ownerEn : ownerByLocale[locale];
  const customer = locale === "en" ? customerEn : customerByLocale[locale];
  const admin = locale === "en" ? adminEn : adminByLocale[locale];
  const shared = locale === "en" ? sharedEn : sharedByLocale[locale];

  if (!bundle.common || typeof bundle.common !== "object") bundle.common = {};
  if (!bundle.auth || typeof bundle.auth !== "object") bundle.auth = {};
  if (!bundle.ownerApp || typeof bundle.ownerApp !== "object") bundle.ownerApp = {};
  if (!bundle.customerApp || typeof bundle.customerApp !== "object") bundle.customerApp = {};
  if (!bundle.adminApp || typeof bundle.adminApp !== "object") bundle.adminApp = {};

  deepMergeOverwrite(bundle.common as JsonObject, buildCommonExtrasFromTs(shared));
  deepMergeOverwrite(
    bundle.auth as JsonObject,
    buildAuthFromTs(owner, customer, admin, shared.phone ?? sharedEn.phone),
  );
  deepMergeOverwrite(bundle.ownerApp as JsonObject, buildOwnerAppFromTs(owner));
  deepMergeOverwrite(bundle.customerApp as JsonObject, buildCustomerAppFromTs(customer));
  deepMergeOverwrite(bundle.adminApp as JsonObject, buildAdminAppFromTs(admin));

  writeFileSync(join(localesDir, `${locale}.json`), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(`Synced ${locale}.json from TS`);
}
