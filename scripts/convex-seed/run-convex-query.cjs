const { execSync } = require("child_process");
const { readFileSync } = require("fs");
const path = require("path");

const convexPkg = path.join(__dirname, "..", "..", "packages", "convex");
const raw = readFileSync(
  path.join(__dirname, process.argv[2] || "query-user-by-email.json"),
  "utf8",
).trim();
const args = JSON.stringify(JSON.stringify(JSON.parse(raw)));

const fn = process.argv[3] || "seed:findUserByEmail";
execSync(`npx convex run ${fn} ${args}`, {
  stdio: "inherit",
  cwd: convexPkg,
  env: process.env,
  shell: true,
});
