/**
 * Patches @expo/ngrok to use system ngrok v3 instead of bundled v2.3.41.
 *
 * Why: ngrok disabled API support for v2 agents (~Feb 2026). Expo's shared
 * account also hit 5000-session limits. Bundled binary fails with
 * "remote gone away" / "Cannot read properties of undefined (reading 'body')".
 *
 * Prerequisite (one-time):
 *   1. Install ngrok v3: https://ngrok.com/download
 *   2. ngrok config add-authtoken YOUR_TOKEN
 *
 * Run after pnpm install:
 *   pnpm patch:expo-ngrok
 *
 * Then native tunnel works again:
 *   pnpm start:expo-tunnel
 *
 * @see https://github.com/expo/expo/issues/43335
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PNPM = path.join(ROOT, "node_modules", ".pnpm");

const PATCHED_INDEX = `const { NgrokClient, NgrokClientError } = require("./src/client");
const {
  getProcess,
  getActiveProcess,
  killProcess,
  setAuthtoken,
  getVersion,
} = require("./src/process");
const { defaults, validate, isRetriable } = require("./src/utils");

let processUrl = null;
let ngrokClient = null;

async function connect(opts) {
  opts = defaults(opts);
  validate(opts);
  // ngrok v3 reads authtoken from ~/.config/ngrok/ngrok.yml — skip v2 setAuthtoken

  processUrl = await getProcess(opts);
  ngrokClient = new NgrokClient(processUrl);
  return connectRetry(opts);
}

async function connectRetry(opts, retryCount = 0) {
  opts.name = "expo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  const tunnelOpts = { ...opts };
  delete tunnelOpts.hostname;
  delete tunnelOpts.subdomain;
  delete tunnelOpts.domain;
  delete tunnelOpts.authtoken;
  delete tunnelOpts.configPath;
  delete tunnelOpts.port;
  delete tunnelOpts.host;
  delete tunnelOpts.httpauth;
  delete tunnelOpts.region;
  delete tunnelOpts.onLogEvent;
  delete tunnelOpts.onStatusChange;
  try {
    const response = await ngrokClient.startTunnel(tunnelOpts);
    return response.public_url;
  } catch (err) {
    const errStr =
      String(err.message || "") +
      String(err.body?.msg || "") +
      String(err.body || "");
    if (errStr.includes("already exists")) {
      try {
        const detail = await ngrokClient.tunnelDetail(tunnelOpts.name);
        return detail.public_url;
      } catch (_) {}
    }
    if (!isRetriable(err) || retryCount >= 100) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    return connectRetry(opts, ++retryCount);
  }
}

async function disconnect(publicUrl) {
  if (!ngrokClient) return;
  const tunnels = (await ngrokClient.listTunnels()).tunnels;
  if (!publicUrl) {
    return Promise.all(tunnels.map((tunnel) => disconnect(tunnel.public_url)));
  }
  const tunnelDetails = tunnels.find((tunnel) => tunnel.public_url === publicUrl);
  if (!tunnelDetails) {
    throw new Error(\`there is no tunnel with url: \${publicUrl}\`);
  }
  return ngrokClient.stopTunnel(tunnelDetails.name);
}

async function kill() {
  if (!ngrokClient) return;
  await killProcess();
  ngrokClient = null;
}

function getUrl() {
  return processUrl;
}

function getApi() {
  return ngrokClient;
}

module.exports = {
  connect,
  disconnect,
  authtoken: setAuthtoken,
  kill,
  getUrl,
  getApi,
  getVersion,
  getActiveProcess,
  NgrokClientError,
};
`;

function findSystemNgrok() {
  try {
    if (process.platform === "win32") {
      const out = execSync("where ngrok", { encoding: "utf8" }).trim().split(/\r?\n/)[0];
      if (out && fs.existsSync(out)) return out;
    } else {
      const out = execSync("which ngrok", { encoding: "utf8" }).trim();
      if (out && fs.existsSync(out)) return out;
    }
  } catch {
    // not on PATH
  }
  return null;
}

function walk(dir, matcher, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (matcher(full, entry.name)) results.push(full);
      if (entry.name !== "node_modules" || dir.includes(".pnpm")) {
        walk(full, matcher, results);
      } else if (full.endsWith("node_modules")) {
        walk(full, matcher, results);
      }
    }
  }
  return results;
}

function patchProcessJs(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const needle = 'if (opts.configPath) start.push("--config=" + opts.configPath);';
  const patched =
    "// v3 patch: skip legacy config path\n  // if (opts.configPath) start.push(\"--config=\" + opts.configPath);";
  if (src.includes(needle) && !src.includes("v3 patch: skip legacy config path")) {
    src = src.replace(needle, patched);
    fs.writeFileSync(filePath, src);
    return true;
  }
  return false;
}

function main() {
  const systemNgrok = findSystemNgrok();
  if (!systemNgrok) {
    console.error("");
    console.error("ERROR: ngrok v3 not found on PATH.");
    console.error("  1. Install from https://ngrok.com/download");
    console.error("  2. ngrok config add-authtoken YOUR_TOKEN");
    console.error("  3. Re-open terminal so PATH updates");
    console.error("");
    console.error("Or use: pnpm start  (uses scripts/expo-tunnel.ps1 without patching node_modules)");
    console.error("");
    process.exit(1);
  }

  console.log("Using system ngrok:", systemNgrok);

  let indexPatches = 0;
  let processPatches = 0;
  let binaryPatches = 0;

  // Patch all @expo/ngrok copies (pnpm may hoist multiple)
  const ngrokDirs = walk(PNPM, (_full, name) => name.startsWith("@expo+ngrok@"));
  for (const dir of ngrokDirs) {
    const indexPath = path.join(dir, "node_modules", "@expo", "ngrok", "index.js");
    const processPath = path.join(dir, "node_modules", "@expo", "ngrok", "src", "process.js");
    if (fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, PATCHED_INDEX);
      indexPatches++;
    }
    if (fs.existsSync(processPath) && patchProcessJs(processPath)) {
      processPatches++;
    }
  }

  // Also patch hoisted copy if present
  const hoistedIndex = path.join(ROOT, "node_modules", "@expo", "ngrok", "index.js");
  const hoistedProcess = path.join(ROOT, "node_modules", "@expo", "ngrok", "src", "process.js");
  if (fs.existsSync(hoistedIndex)) {
    fs.writeFileSync(hoistedIndex, PATCHED_INDEX);
    indexPatches++;
  }
  if (fs.existsSync(hoistedProcess) && patchProcessJs(hoistedProcess)) {
    processPatches++;
  }

  // Replace bundled ngrok v2 binary with system ng3
  const binDirs = walk(PNPM, (_full, name) => name.startsWith("@expo+ngrok-bin-win32-x64@"));
  for (const dir of binDirs) {
    const binName = process.platform === "win32" ? "ngrok.exe" : "ngrok";
    const target = path.join(dir, "node_modules", "@expo", "ngrok-bin-win32-x64", binName);
    if (!fs.existsSync(path.dirname(target))) continue;
    const backup = target + ".v2.bak";
    if (fs.existsSync(target) && !fs.existsSync(backup)) {
      fs.copyFileSync(target, backup);
    }
    fs.copyFileSync(systemNgrok, target);
    binaryPatches++;
  }

  // Unix binary packages if on mac/linux
  if (process.platform !== "win32") {
    const unixBinDirs = walk(PNPM, (_full, name) => name.includes("@expo+ngrok-bin-"));
    for (const dir of unixBinDirs) {
      const candidates = walk(dir, (full) => full.endsWith(`${path.sep}ngrok`));
      for (const target of candidates) {
        if (!fs.statSync(target).isFile()) continue;
        const backup = target + ".v2.bak";
        if (!fs.existsSync(backup) && fs.existsSync(target)) {
          fs.copyFileSync(target, backup);
        }
        fs.copyFileSync(systemNgrok, target);
        try {
          fs.chmodSync(target, 0o755);
        } catch {}
        binaryPatches++;
      }
    }
  }

  console.log("");
  console.log("Patch complete:");
  console.log(`  index.js patched:   ${indexPatches}`);
  console.log(`  process.js patched: ${processPatches}`);
  console.log(`  binary replaced:    ${binaryPatches}`);
  console.log("");
  console.log("You can now run:  pnpm start:expo-tunnel");
  console.log("(Re-run pnpm patch:expo-ngrok after every pnpm install)");
  console.log("");
}

main();
