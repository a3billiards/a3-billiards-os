const { execSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");

const convexPkg = path.join(__dirname, "..", "..", "packages", "convex");
const raw = readFileSync(
  path.join(__dirname, "clear-admin-mfa-rate-limit.json"),
  "utf8",
).trim();
const compact = JSON.stringify(JSON.parse(raw));
const json = JSON.stringify(compact);

execSync(`npx convex run seed:seedClearAdminMfaRateLimit ${json}`, {
  stdio: "inherit",
  cwd: convexPkg,
  env: process.env,
  shell: true,
});
