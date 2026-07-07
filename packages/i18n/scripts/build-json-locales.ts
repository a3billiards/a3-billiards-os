/**
 * Builds packages/i18n/locales/*.json from existing TS locale modules + audit gaps.
 * Run: pnpm --filter @a3/i18n run build:locales
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { en as sharedEn } from "../src/locales/en";
import { errorMessagesEn } from "../src/locales/errors";
import { ownerEn } from "../src/locales/owner/en";
import { customerEn } from "../src/locales/customer/en";
import { adminEn } from "../src/locales/admin/en";
import { auditGapsEn } from "./audit-gaps";

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
const mergeDir = join(localesDir, "_merge");
const gapPatchDir = join(mergeDir, "gap-translations");

const MERGE_SECTIONS = [
  "sharedUi",
  "notifications",
  "ownerApp",
  "customerApp",
  "adminApp",
  "auth",
] as const;

function loadJsonIfExists(path: string): JsonObject | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

/** Deep-merge reviewed _merge/*.json and gap-translations overlays onto built bundles. */
function applyLocaleOverlays(bundle: JsonObject, locale: LocaleCode): JsonObject {
  if (locale === "en") return bundle;
  let out = bundle;
  for (const section of MERGE_SECTIONS) {
    const data = loadJsonIfExists(join(mergeDir, `${section}.${locale}.json`));
    if (data) {
      out = {
        ...out,
        [section]: deepMerge((out[section] ?? {}) as JsonObject, data),
      };
    }
  }
  const gap = loadJsonIfExists(join(gapPatchDir, `${locale}.json`));
  if (gap) {
    out = deepMerge(out, gap);
  }
  return out;
}

type JsonObject = Record<string, unknown>;

const SUPPORTED = ["en", "ar", "hi", "kn", "ml", "te", "ta", "fr", "nl"] as const;
type LocaleCode = (typeof SUPPORTED)[number];

const sharedByLocale: Record<Exclude<LocaleCode, "en">, typeof sharedEn> = {
  ar,
  hi,
  kn,
  ml,
  ta,
  te,
  fr,
  nl,
};

function deepMerge<T extends JsonObject>(base: T, ...overlays: JsonObject[]): T {
  const out = { ...base } as JsonObject;
  for (const overlay of overlays) {
    for (const [key, value] of Object.entries(overlay)) {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof out[key] === "object" &&
        out[key] !== null &&
        !Array.isArray(out[key])
      ) {
        out[key] = deepMerge(out[key] as JsonObject, value as JsonObject);
      } else if (value !== undefined) {
        out[key] = value;
      }
    }
  }
  return out as T;
}

type OwnerLocale = (typeof ownerByLocale)[LocaleCode];

/** English bundle as fallback; localized owner modules override matching keys. */
function buildLocalizedOwnerApp(
  enOwnerApp: JsonObject,
  owner: OwnerLocale,
): JsonObject {
  const enSettings = (enOwnerApp.settings ?? {}) as JsonObject;
  const enSettingsContent = (enSettings.content ?? {}) as JsonObject;

  return deepMerge(enOwnerApp, {
    shell: { noClub: owner.noClub, accessDenied: owner.accessDenied },
    home: owner.home,
    slots: owner.slots,
    snacks: owner.snacks,
    financials: deepMerge(
      (enOwnerApp.financials ?? {}) as JsonObject,
      (owner.financials ?? {}) as JsonObject,
    ),
    complaints: deepMerge(
      (enOwnerApp.complaints ?? {}) as JsonObject,
      (owner.complaints ?? {}) as JsonObject,
    ),
    bookings: deepMerge(
      (enOwnerApp.bookings ?? {}) as JsonObject,
      (owner.bookings ?? {}) as JsonObject,
    ),
    documents: deepMerge(
      (enOwnerApp.documents ?? {}) as JsonObject,
      (owner.documents ?? {}) as JsonObject,
    ),
    kitchen: owner.kitchen,
    livestream: owner.livestream,
    help: owner.help ?? enOwnerApp.help,
    settings: deepMerge(
      enSettings,
      {
        content: deepMerge(enSettingsContent, owner.settingsContent ?? {}),
        passcode: owner.passcode,
      },
      owner.settings ?? {},
    ),
  });
}

function buildSharedCommonOverlay(
  enCommon: JsonObject,
  shared: (typeof sharedEn),
): JsonObject {
  return deepMerge(enCommon, {
    ...(shared.common ?? {}),
    tabs: shared.tabs,
    phone: shared.phone ?? enCommon.phone,
    language: shared.settings,
    config: shared.config,
    subscription: shared.subscription,
    inbox: shared.inbox,
    streaming: shared.streaming,
    profile: shared.profile,
  });
}

function buildEnBundle(): JsonObject {
  return {
    common: deepMerge(
      { ...sharedEn.common },
      { ...auditGapsEn.common },
      {
        tabs: sharedEn.tabs,
        phone: sharedEn.phone,
        language: sharedEn.settings,
        config: sharedEn.config,
        subscription: sharedEn.subscription,
        inbox: sharedEn.inbox,
        streaming: sharedEn.streaming,
        profile: sharedEn.profile,
      },
    ),
    auth: {
      phone: sharedEn.phone,
      owner: {
        login: ownerEn.login,
        register: ownerEn.register,
        verifyPhone: ownerEn.verifyPhone,
        changePassword: ownerEn.changePassword,
        changePasscode: ownerEn.changePasscode,
        passcode: ownerEn.passcode,
      },
      customer: {
        login: customerEn.login,
        register: customerEn.register,
        verifyPhone: customerEn.verifyPhone,
        setPassword: customerEn.setPassword,
        changePassword: customerEn.changePassword,
        accountBlocked: customerEn.accountBlocked,
      },
      admin: {
        login: adminEn.login,
        mfa: adminEn.mfa,
        shell: adminEn.shell,
      },
    },
    ownerApp: deepMerge(
      {
        shell: {
          noClub: ownerEn.noClub,
          accessDenied: ownerEn.accessDenied,
        },
        home: ownerEn.home,
        slots: ownerEn.slots,
        snacks: ownerEn.snacks,
        financials: ownerEn.financials,
        complaints: deepMerge(
          { ...ownerEn.complaints },
          auditGapsEn.ownerApp.complaints as JsonObject,
        ),
        bookings: deepMerge(
          { ...ownerEn.bookings },
          auditGapsEn.ownerApp.bookings as JsonObject,
        ),
        settings: deepMerge(
          {
            ...ownerEn.settings,
            content: ownerEn.settingsContent,
            passcode: ownerEn.passcode,
          },
          auditGapsEn.ownerApp.settings as JsonObject,
        ),
        documents: deepMerge(
          { ...ownerEn.documents },
          auditGapsEn.ownerApp.documents as JsonObject,
        ),
        kitchen: ownerEn.kitchen,
        loyalty: auditGapsEn.ownerApp.loyalty,
        livestream: ownerEn.livestream,
        help: ownerEn.help,
        gstReport: {
          financialsGst: {
            disclaimerTitle: ownerEn.financials.gstDisclaimerTitle,
            disclaimerBody: ownerEn.financials.gstDisclaimerBody,
            configureHint: ownerEn.financials.gstConfigureHint,
            invalidRange: ownerEn.financials.gstInvalidRange,
            periodSummary: ownerEn.financials.gstPeriodSummary,
            period: ownerEn.financials.gstPeriod,
            sessionsRealised: ownerEn.financials.gstSessionsRealised,
            gstin: ownerEn.financials.gstin,
            notRegisteredNote: ownerEn.financials.gstNotRegisteredNote,
            taxableRevenue: ownerEn.financials.gstTaxableRevenue,
            tableTimeAfterDiscounts: ownerEn.financials.gstTableTimeAfterDiscounts,
            totalTaxable: ownerEn.financials.gstTotalTaxable,
            outputEstimate: ownerEn.financials.gstOutputEstimate,
            onTableTime: ownerEn.financials.gstOnTableTime,
            onSnacks: ownerEn.financials.gstOnSnacks,
            totalOutput: ownerEn.financials.gstTotalOutput,
            cgst: ownerEn.financials.cgst,
            sgst: ownerEn.financials.sgst,
            igst: ownerEn.financials.igst,
            netPayableEstimate: ownerEn.financials.gstNetPayableEstimate,
            inputTaxCredit: ownerEn.financials.gstInputTaxCredit,
            netPayable: ownerEn.financials.gstNetPayable,
            footnote: ownerEn.financials.gstFootnote,
          },
        },
        resetCredential: auditGapsEn.ownerApp.resetCredential,
      },
      {
        financials: auditGapsEn.ownerApp.financials,
      } as JsonObject,
    ),
    customerApp: deepMerge(
      {
        home: customerEn.home,
        discovery: customerEn.discover,
        clubProfile: customerEn.club,
        booking: customerEn.book,
        bookingDetail: customerEn.bookingDetail,
        myBookings: customerEn.bookings,
        history: customerEn.history,
        loyalty: {
          profile: customerEn.profile,
        },
        live: customerEn.live,
        profile: customerEn.profile,
        streaming: customerEn.streaming,
        screens: customerEn.screens,
        help: customerEn.help,
      },
      auditGapsEn.customerApp as JsonObject,
    ),
    adminApp: {
      dashboard: adminEn.dashboard,
      users: adminEn.users,
      roles: adminEn.roles,
      complaints: adminEn.complaints,
      moderation: adminEn.liveModeration,
      audit: adminEn.audit,
      notifications: adminEn.notifications,
      sessions: adminEn.sessions,
      bookings: adminEn.bookings,
      userProfile: adminEn.userProfile,
      support: adminEn.support,
      clubs: adminEn.clubs,
    },
    sharedUi: auditGapsEn.sharedUi,
    errors: deepMerge(
      { ...errorMessagesEn },
      auditGapsEn.errors as JsonObject,
    ),
    notifications: auditGapsEn.notifications,
  };
}

function translateBundle(
  locale: LocaleCode,
  enBundle: JsonObject,
): JsonObject {
  if (locale === "en") return enBundle;

  const shared = sharedByLocale[locale];

  const owner = ownerByLocale[locale as keyof typeof ownerByLocale];
  const customer = customerByLocale[locale as keyof typeof customerByLocale];
  const admin = adminByLocale[locale as keyof typeof adminByLocale];

  return deepMerge(enBundle, {
    common: buildSharedCommonOverlay(
      enBundle.common as JsonObject,
      shared,
    ),
    auth: {
      phone: shared.phone ?? (enBundle.auth as JsonObject)?.phone ?? sharedEn.phone,
      owner: {
        login: owner.login,
        register: owner.register,
        verifyPhone: owner.verifyPhone,
        changePassword: owner.changePassword,
        changePasscode: owner.changePasscode,
        passcode: owner.passcode,
      },
      customer: {
        login: customer.login,
        register: customer.register,
        verifyPhone: customer.verifyPhone,
        setPassword: customer.setPassword,
        changePassword: customer.changePassword,
        accountBlocked: customer.accountBlocked,
      },
      admin: {
        login: admin.login,
        mfa: admin.mfa,
        shell: admin.shell,
      },
    },
    ownerApp: buildLocalizedOwnerApp(
      enBundle.ownerApp as JsonObject,
      owner,
    ),
    customerApp: deepMerge(
      {
        home: customer.home,
        discovery: customer.discover,
        clubProfile: customer.club,
        booking: customer.book,
        bookingDetail: customer.bookingDetail,
        myBookings: customer.bookings,
        history: customer.history,
        profile: customer.profile,
        live: customer.live,
        streaming: customer.streaming,
        screens: customer.screens,
        help: customer.help ?? (enBundle.customerApp as JsonObject)?.help,
      },
      locale === "en"
        ? {}
        : { googleAuth: (enBundle.customerApp as JsonObject)?.googleAuth },
    ),
    adminApp: {
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
      support: admin.support ?? (enBundle.adminApp as JsonObject)?.support,
      clubs: admin.clubs ?? (enBundle.adminApp as JsonObject)?.clubs,
    },
    errors: shared.errors ?? enBundle.errors,
    // sharedUi, notifications, audit gaps: English fallback for non-en until native review
  });
}

function flattenKeys(obj: JsonObject, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as JsonObject, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function countLeafKeys(obj: JsonObject): number {
  return flattenKeys(obj).length;
}

function main(): void {
  mkdirSync(localesDir, { recursive: true });

  const enBundle = buildEnBundle();
  writeFileSync(
    join(localesDir, "en.json"),
    `${JSON.stringify(enBundle, null, 2)}\n`,
    "utf8",
  );

  const enKeys = new Set(flattenKeys(enBundle));
  const gaps: string[] = [];

  for (const locale of SUPPORTED) {
    if (locale === "en") continue;
    const bundle = applyLocaleOverlays(translateBundle(locale, enBundle), locale);
    writeFileSync(
      join(localesDir, `${locale}.json`),
      `${JSON.stringify(bundle, null, 2)}\n`,
      "utf8",
    );
    const localeKeys = new Set(flattenKeys(bundle));
    for (const key of enKeys) {
      if (!localeKeys.has(key)) gaps.push(`${locale}: missing ${key}`);
    }
    for (const key of localeKeys) {
      if (!enKeys.has(key)) gaps.push(`${locale}: extra ${key}`);
    }
  }

  const reviewPath = join(localesDir, "review_needed.md");
  const reviewLines = [
    "# Translation review needed",
    "",
    "Keys below use English fallback or German→Dutch provisional text.",
    "",
    ...buildReviewNotes(),
  ];
  writeFileSync(reviewPath, `${reviewLines.join("\n")}\n`, "utf8");

  const completenessPath = join(localesDir, "completeness-check.txt");
  writeFileSync(
    completenessPath,
    [
      `en.json leaf keys: ${countLeafKeys(enBundle)}`,
      ...SUPPORTED.filter((l) => l !== "en").map((l) => {
        const bundle = JSON.parse(
          readFileSync(join(localesDir, `${l}.json`), "utf8"),
        ) as JsonObject;
        return `${l}.json leaf keys: ${countLeafKeys(bundle)}`;
      }),
      "",
      gaps.length === 0 ? "All locales: key parity OK" : gaps.join("\n"),
    ].join("\n"),
    "utf8",
  );

  console.log(`Built ${SUPPORTED.length} locale files in ${localesDir}`);
  console.log(`en.json leaf keys: ${countLeafKeys(enBundle)}`);
  console.log(gaps.length ? `Gaps:\n${gaps.join("\n")}` : "Key parity: OK");
}

function buildReviewNotes(): string[] {
  return buildPerKeyReviewNotes();
}

function buildPerKeyReviewNotes(): string[] {
  const enBundle = JSON.parse(
    readFileSync(join(localesDir, "en.json"), "utf8"),
  ) as JsonObject;

  const prefixesNeedingReview = [
    "sharedUi.",
    "notifications.",
    "ownerApp.loyalty.",
    "ownerApp.settings.", // includes audit-gap strings still in source
    "customerApp.googleAuth.",
  ];

  const notes: string[] = [];
  for (const locale of SUPPORTED) {
    if (locale === "en") continue;
    const bundle = JSON.parse(
      readFileSync(join(localesDir, `${locale}.json`), "utf8"),
    ) as JsonObject;

    notes.push(`## ${locale}`);
    if (locale === "nl") {
      notes.push(
        "[nl] *all keys* — provisional Dutch bundle derived from German until native review",
      );
    }

    const enFlat = flattenKeyValues(enBundle);
    const locFlat = flattenKeyValues(bundle);

    const reviewKeys: string[] = [];
    for (const [key, enValue] of enFlat) {
      if (!prefixesNeedingReview.some((p) => key.startsWith(p))) continue;
      const locValue = locFlat.get(key);
      if (locValue === undefined) continue;
      if (locValue === enValue) reviewKeys.push(key);
    }

    if (reviewKeys.length === 0) {
      notes.push("(none)");
      notes.push("");
      continue;
    }

    for (const key of reviewKeys.sort()) {
      notes.push(
        `[${locale}] ${key} — English fallback (needs translation review)`,
      );
    }
    notes.push("");
  }
  return notes;
}

function flattenKeyValues(obj: JsonObject, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const child = flattenKeyValues(v as JsonObject, path);
      for (const [ck, cv] of child) out.set(ck, cv);
    } else if (typeof v === "string") {
      out.set(path, v);
    }
  }
  return out;
}

main();
