/**
 * Runs seed:seedAdminUser with args from seed-test-admin.json
 * (Windows-safe JSON for PowerShell).
 */
const { execSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");

const convexPkg = path.join(__dirname, "..", "..", "packages", "convex");
const raw = readFileSync(
  path.join(__dirname, "seed-test-admin.json"),
  "utf8",
).trim();
const compact = JSON.stringify(JSON.parse(raw));
const json = JSON.stringify(compact);

execSync(`npx convex run seed:seedAdminUser ${json}`, {
  stdio: "inherit",
  cwd: convexPkg,
  env: process.env,
  shell: true,
});
