/**
 * Adds missing keys from legacy TS locale bundles into locales/*.json
 * without overwriting existing values.
 *
 * Run: pnpm --filter @a3/i18n exec tsx scripts/migrate-ts-to-json.ts
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

function deepMergeFillMissing(target: JsonObject, source: JsonObject, prefix = ""): string[] {
  const added: string[] = [];
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (
        target[key] === undefined ||
        target[key] === null ||
        typeof target[key] !== "object" ||
        Array.isArray(target[key])
      ) {
        target[key] = {};
      }
      added.push(
        ...deepMergeFillMissing(target[key] as JsonObject, value as JsonObject, path),
      );
    } else if (target[key] === undefined) {
      target[key] = value;
      added.push(path);
    }
  }
  return added;
}

function buildOwnerAppFromTs(owner: typeof ownerEn): JsonObject {
  return {
    shell: {
      noClub: owner.noClub,
      accessDenied: owner.accessDenied,
    },
    home: owner.home,
    slots: owner.slots,
    snacks: owner.snacks,
    financials: owner.financials,
    complaints: owner.complaints,
    bookings: owner.bookings,
    settings: {
      ...owner.settings,
      content: owner.settingsContent,
      passcode: owner.passcode,
    },
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
    loyalty: {
      profile: customer.profile,
    },
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
    admin: {
      login: admin.login,
      mfa: admin.mfa,
      shell: admin.shell,
    },
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

function leafCount(obj: JsonObject): number {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) n += leafCount(v as JsonObject);
    else n += 1;
  }
  return n;
}

function flattenKeys(obj: JsonObject, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) keys.push(...flattenKeys(v as JsonObject, p));
    else keys.push(p);
  }
  return keys;
}

function getNested(obj: JsonObject, parts: string[]): unknown {
  let node: unknown = obj;
  for (const part of parts) {
    if (node && typeof node === "object" && !Array.isArray(node) && part in (node as JsonObject)) {
      node = (node as JsonObject)[part];
    } else return undefined;
  }
  return node;
}

function setNested(obj: JsonObject, parts: string[], value: unknown): void {
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!node[parts[i]] || typeof node[parts[i]] !== "object") node[parts[i]] = {};
    node = node[parts[i]] as JsonObject;
  }
  node[parts[parts.length - 1]] = value;
}

function loadBundle(locale: LocaleCode): JsonObject {
  return JSON.parse(readFileSync(join(localesDir, `${locale}.json`), "utf8")) as JsonObject;
}

function saveBundle(locale: LocaleCode, bundle: JsonObject): void {
  writeFileSync(join(localesDir, `${locale}.json`), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

const enBefore = loadBundle("en");
const enBeforeCount = leafCount(enBefore);
const allAddedEn: string[] = [];

// --- en.json ---
const en = loadBundle("en");
const ownerAppEn = buildOwnerAppFromTs(ownerEn);
const customerAppEn = buildCustomerAppFromTs(customerEn);
const authEn = buildAuthFromTs(ownerEn, customerEn, adminEn, sharedEn.phone);
const adminAppEn = buildAdminAppFromTs(adminEn);
const commonExtrasEn = buildCommonExtrasFromTs(sharedEn);

if (!en.common || typeof en.common !== "object") en.common = {};
allAddedEn.push(...deepMergeFillMissing(en.common as JsonObject, commonExtrasEn, "common"));
allAddedEn.push(...deepMergeFillMissing(en.auth as JsonObject, authEn, "auth"));
allAddedEn.push(...deepMergeFillMissing(en.ownerApp as JsonObject, ownerAppEn, "ownerApp"));
allAddedEn.push(...deepMergeFillMissing(en.customerApp as JsonObject, customerAppEn, "customerApp"));
allAddedEn.push(...deepMergeFillMissing(en.adminApp as JsonObject, adminAppEn, "adminApp"));
saveBundle("en", en);

const enAfterCount = leafCount(en);
const deltaEn = enAfterCount - enBeforeCount;

// --- non-English ---
const enKeys = new Set(flattenKeys(en));
const parityIssues: string[] = [];
const englishFallbacks: { locale: string; key: string }[] = [];

for (const locale of LOCALES) {
  if (locale === "en") continue;

  const bundle = loadBundle(locale);
  const owner = ownerByLocale[locale];
  const customer = customerByLocale[locale];
  const admin = adminByLocale[locale];
  const shared = sharedByLocale[locale];

  const ownerApp = buildOwnerAppFromTs(owner);
  const customerApp = buildCustomerAppFromTs(customer);
  const auth = buildAuthFromTs(owner, customer, admin, shared.phone ?? sharedEn.phone);
  const adminApp = buildAdminAppFromTs(admin);
  const commonExtras = buildCommonExtrasFromTs(shared);

  if (!bundle.common || typeof bundle.common !== "object") bundle.common = {};
  deepMergeFillMissing(bundle.common as JsonObject, commonExtras, "common");
  deepMergeFillMissing(bundle.auth as JsonObject, auth, "auth");
  deepMergeFillMissing(bundle.ownerApp as JsonObject, ownerApp, "ownerApp");
  deepMergeFillMissing(bundle.customerApp as JsonObject, customerApp, "customerApp");
  deepMergeFillMissing(bundle.adminApp as JsonObject, adminApp, "adminApp");

  // Fill any keys still missing vs en with English fallback + track for review
  for (const key of enKeys) {
    const parts = key.split(".");
    const enVal = getNested(en, parts);
    const locVal = getNested(bundle, parts);
    if (locVal === undefined && enVal !== undefined) {
      setNested(bundle, parts, enVal);
      englishFallbacks.push({ locale, key });
    }
  }

  saveBundle(locale, bundle);

  const localeKeys = new Set(flattenKeys(bundle));
  for (const key of enKeys) {
    if (!localeKeys.has(key)) parityIssues.push(`${locale}: missing ${key}`);
  }
  for (const key of localeKeys) {
    if (!enKeys.has(key)) parityIssues.push(`${locale}: extra ${key}`);
  }
}

// Write migration report
const reportPath = join(localesDir, "migration-report.txt");
writeFileSync(
  reportPath,
  [
    `en.json keys before: ${enBeforeCount}`,
    `en.json keys after: ${enAfterCount}`,
    `new keys added to en.json: ${deltaEn}`,
    `sample added keys (first 30):`,
    ...allAddedEn.slice(0, 30).map((k) => `  ${k}`),
    "",
    `parity issues: ${parityIssues.length}`,
    ...parityIssues.slice(0, 50),
    "",
    `english fallbacks used: ${englishFallbacks.length}`,
    ...englishFallbacks.slice(0, 50).map((e) => `  [${e.locale}] ${e.key}`),
  ].join("\n"),
  "utf8",
);

console.log(`en.json: ${enBeforeCount} -> ${enAfterCount} (+${deltaEn} keys)`);
console.log(`Added ${allAddedEn.length} paths via fill-missing`);
console.log(`Parity issues: ${parityIssues.length}`);
console.log(`English fallbacks: ${englishFallbacks.length}`);
console.log(`Report: ${reportPath}`);
