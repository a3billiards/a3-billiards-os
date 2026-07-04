/**
 * Writes packages/i18n/locales/_merge/auth.{lang}.json and adminApp.{lang}.json
 * from TS locale modules. Run: pnpm exec tsx scripts/write-auth-admin-merge.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
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
const mergeDir = join(__dirname, "..", "locales", "_merge");

type JsonObject = Record<string, unknown>;

const sharedByLocale = { ar, hi, kn, ml, ta, te, fr, nl } as const;
const locales = ["en", "ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"] as const;

function buildAuth(
  owner: typeof ownerEn,
  customer: typeof customerEn,
  admin: typeof adminEn,
  phone: typeof sharedEn.phone | undefined,
): JsonObject {
  const auth: JsonObject = {};
  if (phone) {
    auth.phone = phone;
  }
  auth.admin = {
    login: admin.login,
    mfa: admin.mfa,
    shell: admin.shell,
  };
  auth.customer = {
    login: customer.login,
    register: customer.register,
    verifyPhone: customer.verifyPhone,
    setPassword: customer.setPassword,
    changePassword: customer.changePassword,
    accountBlocked: customer.accountBlocked,
  };
  auth.owner = {
    login: owner.login,
    register: owner.register,
    verifyPhone: owner.verifyPhone,
    changePassword: owner.changePassword,
    changePasscode: owner.changePasscode,
    passcode: owner.passcode,
  };
  return auth;
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

function main(): void {
  mkdirSync(mergeDir, { recursive: true });

  const counts: { lang: string; auth: number; adminApp: number }[] = [];

  for (const locale of locales) {
    let auth: JsonObject;
    let adminApp: JsonObject;

    if (locale === "en") {
      auth = buildAuth(ownerEn, customerEn, adminEn, sharedEn.phone);
      adminApp = buildAdminApp(adminEn);
    } else {
      const shared = sharedByLocale[locale];
      const owner = ownerByLocale[locale];
      const customer = customerByLocale[locale];
      const admin = adminByLocale[locale];
      auth = buildAuth(owner, customer, admin, shared.phone);
      adminApp = buildAdminApp(admin);
    }

    writeFileSync(
      join(mergeDir, `auth.${locale}.json`),
      `${JSON.stringify(auth, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(mergeDir, `adminApp.${locale}.json`),
      `${JSON.stringify(adminApp, null, 2)}\n`,
      "utf8",
    );

    counts.push({
      lang: locale,
      auth: leafCount(auth),
      adminApp: leafCount(adminApp),
    });
  }

  console.log("Leaf key counts:");
  console.log("lang\tauth\tadminApp");
  for (const { lang, auth, adminApp } of counts) {
    console.log(`${lang}\t${auth}\t${adminApp}`);
  }
}

main();
