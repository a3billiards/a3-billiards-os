/**
 * Runs seed:seedTestOwnerWithClub with args from seed-test-owner-with-club.json
 * so Windows PowerShell does not strip JSON string quotes.
 */
const { execSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const raw = readFileSync(
  path.join(__dirname, "seed-test-owner-with-club.json"),
  "utf8",
).trim();
const compact = JSON.stringify(JSON.parse(raw));
const json = JSON.stringify(compact);

execSync(`npx convex run seed:seedTestOwnerWithClub ${json}`, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
  shell: true,
});
