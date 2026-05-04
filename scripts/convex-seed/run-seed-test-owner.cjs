/**
 * Runs seed:seedTestOwnerWithClub with args from seed-test-owner-with-club.json
 * so Windows PowerShell does not strip JSON string quotes.
 *
 * Lives outside packages/convex so `convex dev` does not try to bundle Node builtins.
 */
const { execSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");

const convexPkg = path.join(__dirname, "..", "..", "packages", "convex");
const raw = readFileSync(
  path.join(__dirname, "seed-test-owner-with-club.json"),
  "utf8",
).trim();
const compact = JSON.stringify(JSON.parse(raw));
const json = JSON.stringify(compact);

execSync(`npx convex run seed:seedTestOwnerWithClub ${json}`, {
  stdio: "inherit",
  cwd: convexPkg,
  env: process.env,
  shell: true,
});
