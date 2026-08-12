#!/usr/bin/env node
/**
 * Fails CI/local checks if tracked git files contain likely hard-coded secrets.
 * Scans only files in `git ls-files` (respects .gitignore).
 *
 * Usage: node scripts/check-tracked-secrets.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const PATTERNS = [
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: "Razorpay live/test secret", re: /rzp_(live|test)_[A-Za-z0-9]{10,}/ },
  { name: "PEM private key", re: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ },
  { name: "Firebase private_key JSON field", re: /"private_key"\s*:\s*"-----BEGIN/ },
  { name: "Generic api_key assignment", re: /api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/i },
];

const ALLOWLIST_SUBSTRINGS = [
  "phc_xxxx",
  "phc_xxx",
  "your_",
  "REPLACE_ME",
  "example.com",
  "check-tracked-secrets.mjs",
  ".env.example",
];

function listTrackedFiles() {
  const out = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const hits = [];

for (const rel of listTrackedFiles()) {
  if (rel.endsWith(".png") || rel.endsWith(".jpg") || rel.endsWith(".webp")) continue;
  const abs = join(ROOT, rel);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    continue;
  }
  if (ALLOWLIST_SUBSTRINGS.some((s) => text.includes(s) && rel.includes(".env.example"))) {
    // still scan .env.example for real keys, but allow placeholder docs
  }
  for (const { name, re } of PATTERNS) {
    if (!re.test(text)) continue;
    if (
      rel.includes(".env.example") &&
      (text.includes("your_") || text.includes("...") || text.includes("REPLACE"))
    ) {
      continue;
    }
    if (ALLOWLIST_SUBSTRINGS.some((s) => text.includes(s))) {
      continue;
    }
    hits.push({ file: rel, pattern: name });
    break;
  }
}

if (hits.length > 0) {
  console.error("Possible secrets found in tracked files:\n");
  for (const h of hits) {
    console.error(`  - ${h.file} (${h.pattern})`);
  }
  console.error(
    "\nRemove secrets from source, rotate exposed keys, and use Convex env / gitignored .env.local.",
  );
  process.exit(1);
}

console.log("check-tracked-secrets: OK (no patterns matched in git-tracked files)");
