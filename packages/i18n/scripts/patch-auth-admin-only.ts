/**
 * Patches auth.* and adminApp.* into locales/*.json from TS locale modules.
 * Does not modify other sections (common, errors, sharedUi, etc.).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { en as sharedEn } from "../src/locales/en";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "locales");

const sharedByLocale = { ar, hi, kn, ml, ta, te, fr, nl } as const;

type JsonObject = Record<string, unknown>;

function buildAuth(
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

function buildAdminApp(admin: typeof adminEn): JsonObject {
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

function leafCount(obj: JsonObject): number {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      n += leafCount(v as JsonObject);
    } else {
      n += 1;
    }
  }
  return n;
}

const locales = ["en", "ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"] as const;

for (const locale of locales) {
  const path = join(localesDir, `${locale}.json`);
  const bundle = JSON.parse(readFileSync(path, "utf8")) as JsonObject;

  if (locale === "en") {
    bundle.auth = buildAuth(ownerEn, customerEn, adminEn, sharedEn.phone);
    bundle.adminApp = buildAdminApp(adminEn);
  } else {
    const shared = sharedByLocale[locale];
    const owner = ownerByLocale[locale];
    const customer = customerByLocale[locale];
    const admin = adminByLocale[locale];
    bundle.auth = buildAuth(owner, customer, admin, shared.phone);
    bundle.adminApp = buildAdminApp(admin);
  }

  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(
    `${locale}.json: auth=${leafCount(bundle.auth as JsonObject)} adminApp=${leafCount(bundle.adminApp as JsonObject)} keys`,
  );
}
