/**
 * Runs seed:seedTestClubForUserId.
 *
 * Preferred (no JSON file edit):
 *   pnpm seed:test-club -- <users_table_document_id>
 * Optional second arg "false" skips creating the first table (default: true).
 *
 * Or set userId in scripts/convex-seed/seed-test-club-for-user.json and run without args.
 *
 * Lives outside packages/convex so `convex dev` does not try to bundle Node builtins.
 */
const { execSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");

const convexPkg = path.join(__dirname, "..", "..", "packages", "convex");

const cliUserId = process.argv[2];
let parsed;

if (cliUserId && cliUserId.trim().length > 0) {
  const withTable = process.argv[3] !== "false";
  parsed = { userId: cliUserId.trim(), withTable };
} else {
  const raw = readFileSync(
    path.join(__dirname, "seed-test-club-for-user.json"),
    "utf8",
  ).trim();
  parsed = JSON.parse(raw);
  if (
    !parsed.userId ||
    typeof parsed.userId !== "string" ||
    parsed.userId.includes("PASTE") ||
    parsed.userId.includes("HERE")
  ) {
    console.error(`
Missing userId. Either:

  pnpm seed:test-club -- <your_users_document_id>

(find _id in Convex dashboard → Data → users)

Or edit scripts/convex-seed/seed-test-club-for-user.json and replace the userId value.
`);
    process.exit(1);
  }
}

const compact = JSON.stringify(parsed);
const json = JSON.stringify(compact);

execSync(`npx convex run seed:seedTestClubForUserId ${json}`, {
  stdio: "inherit",
  cwd: convexPkg,
  env: process.env,
  shell: true,
});
