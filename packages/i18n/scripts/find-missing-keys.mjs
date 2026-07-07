/**
 * Audits t("...") usage across apps + shared UI against en.json.
 * Also resolves common dynamic key patterns (template literals, const maps).
 *
 * Run: node packages/i18n/scripts/find-missing-keys.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const en = JSON.parse(
  fs.readFileSync(path.join(root, "packages/i18n/locales/en.json"), "utf8"),
);

function hasKey(obj, key) {
  const parts = key.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return false;
    cur = cur[p];
  }
  return typeof cur === "string";
}

function walk(dir, keys = new Set()) {
  if (!fs.existsSync(dir)) return keys;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules") continue;
      walk(p, keys);
    } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
      const s = fs.readFileSync(p, "utf8");
      const staticRe =
        /t\(\s*["'`]((?:common|ownerApp|customerApp|adminApp|auth|sharedUi|errors|notifications)\.[a-zA-Z0-9_.-]+)["'`]/g;
      let m;
      while ((m = staticRe.exec(s))) keys.add(m[1]);

      // Template literal prefix: t(`${base}.suffix`) or t(`prefix.${var}`)
      const tplRe =
        /t\(\s*`((?:common|ownerApp|customerApp|adminApp|auth|sharedUi|errors|notifications)\.[a-zA-Z0-9_.${}-]+)`/g;
      while ((m = tplRe.exec(s))) {
        const tpl = m[1];
        if (!tpl.includes("${")) {
          keys.add(tpl);
          continue;
        }
        resolveTemplate(tpl, s).forEach((k) => keys.add(k));
      }

      // String const maps: key: "ownerApp.foo.bar"
      const mapRe =
        /["'`]((?:common|ownerApp|customerApp|adminApp|auth|sharedUi|errors|notifications)\.[a-zA-Z0-9_.-]+)["'`]/g;
      while ((m = mapRe.exec(s))) {
        const k = m[1];
        if (k.includes("${")) continue;
        // faqKeyPrefix values are namespaces, not leaf keys
        if (/\.faq$/.test(k)) continue;
        keys.add(k);
      }
    }
  }
  return keys;
}

function resolveTemplate(tpl, fileContent) {
  const keys = new Set();
  const varMatch = tpl.match(/\$\{([^}]+)\}/);
  if (!varMatch) return keys;

  const varExpr = varMatch[1].trim();
  const prefix = tpl.slice(0, varMatch.index);
  const suffix = tpl.slice(varMatch.index + varMatch[0].length);

  // Inline union: (${"a"|"b"})
  const inlineUnion = varExpr.match(/^\$\{?"([^"]+)"(?:\|"([^"]+)")+\}$/);
  if (inlineUnion) {
    const parts = varExpr.match(/"([^"]+)"/g)?.map((x) => x.slice(1, -1)) ?? [];
    for (const p of parts) keys.add(`${prefix}${p}${suffix}`);
    return keys;
  }

  // as const array: (["pending", "upcoming"] as const)
  const arrayMatch = fileContent.match(
    new RegExp(
      `\\[([^\\]]*["']([^"']+)["'][^\\]]*)\\]\\s+as\\s+const[^\\n]*\\n[^\\n]*\\$\\{${escapeRegExp(varExpr)}\\}`,
    ),
  );
  if (arrayMatch) {
    const literals = [...arrayMatch[0].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
    for (const lit of literals) keys.add(`${prefix}${lit}${suffix}`);
    return keys;
  }

  // Lookup const by name: WEEK_DAY_KEYS[d], DURATION_KEY_MAP[durationMin], typeKey, etc.
  const constName = varExpr.split(/[\[.]/)[0];
  const constBlock = extractConstObject(fileContent, constName);
  if (constBlock) {
    for (const v of constBlock) keys.add(`${prefix}${v}${suffix}`);
    return keys;
  }

  // Enum-like keys from nearby object keys
  const objKeys = extractNearbyStringKeys(fileContent, tpl);
  for (const k of objKeys) keys.add(`${prefix}${k}${suffix}`);

  return keys;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractConstObject(content, name) {
  const re = new RegExp(
    `(?:const|let)\\s+${escapeRegExp(name)}\\s*=\\s*\\{([^}]+)\\}`,
    "s",
  );
  const m = content.match(re);
  if (!m) return null;
  const vals = [...m[1].matchAll(/:\s*["']([^"']+)["']/g)].map((x) => x[1]);
  return vals.length ? vals : null;
}

function extractNearbyStringKeys(content, tpl) {
  const base = tpl.split(".")[0];
  const section = content.indexOf(tpl.split("${")[0]);
  if (section < 0) return [];
  const slice = content.slice(Math.max(0, section - 800), section + 800);
  return [
    ...new Set(
      [...slice.matchAll(/["']([a-z][a-z0-9_]+)["']\s*:/g)].map((x) => x[1]),
    ),
  ];
}

const dirs = [
  path.join(root, "apps/admin-app/src"),
  path.join(root, "apps/customer-app/src"),
  path.join(root, "apps/owner-app/src"),
  path.join(root, "packages/ui"),
];

const all = new Set();
for (const d of dirs) walk(d, all);

// HelpSupportPanel FAQ ids
const helpFaqIds = {
  "ownerApp.help.faq": [
    "subscription",
    "walkInSessions",
    "onlineBooking",
    "staffRoles",
    "liveStream",
    "gstReport",
    "complaintsFlags",
    "dataExport",
  ],
  "customerApp.help.faq": [
    "discoverBook",
    "payBooking",
    "cancelBooking",
    "sessionHistory",
    "liveStreams",
    "accountFrozen",
    "changePhone",
    "notifications",
  ],
};
for (const [prefix, ids] of Object.entries(helpFaqIds)) {
  for (const id of ids) {
    all.add(`${prefix}.${id}.q`);
    all.add(`${prefix}.${id}.a`);
  }
  const base = prefix.replace(/\.faq$/, "");
  for (const cat of [
    "account",
    "booking",
    "payment",
    "subscription",
    "technical",
    "other",
  ]) {
    all.add(`${base}.categories.${cat}`);
  }
  for (const st of ["open", "in_progress", "resolved", "closed"]) {
    all.add(`${base}.status.${st}`);
  }
}

const missing = [...all].filter((k) => !hasKey(en, k)).sort();
console.log(`Total keys resolved: ${all.size}`);
console.log(`Missing from en.json: ${missing.length}`);
for (const k of missing) console.log(k);
process.exit(missing.length > 0 ? 1 : 0);
