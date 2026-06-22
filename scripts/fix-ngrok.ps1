# Restores original ngrok v2 binary and then replaces it with downloaded ngrok v3.
# Run once from repo root:  .\scripts\fix-ngrok.ps1

$ErrorActionPreference = "Stop"

$NGROK_BIN_DIR = "node_modules\.pnpm\@expo+ngrok-bin-win32-x64@2.3.41\node_modules\@expo\ngrok-bin-win32-x64"
$NGROK_EXE    = Join-Path $NGROK_BIN_DIR "ngrok.exe"
$NGROK_BAK    = Join-Path $NGROK_EXE ".v2.bak"   # wrong — let me fix

# Correct backup path
$NGROK_BAK    = "$NGROK_EXE.v2.bak"

Write-Host ""
Write-Host "=== Fixing expo tunnel ===" -ForegroundColor Cyan
Write-Host ""

# Step 1 — Restore original v2 backup first (so we have a known state)
if (Test-Path $NGROK_BAK) {
    Copy-Item -Path $NGROK_BAK -Destination $NGROK_EXE -Force
    Write-Host "Restored v2 binary from backup." -ForegroundColor Gray
}

# Step 2 — Download ngrok v3 for Windows
$NGROK_ZIP  = "$env:TEMP\ngrok-v3-win.zip"
$NGROK_V3   = "$env:TEMP\ngrok-v3.exe"
$DOWNLOAD_URL = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"

Write-Host "Downloading ngrok v3..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $NGROK_ZIP -UseBasicParsing
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual option:"
    Write-Host "  1. Download https://ngrok.com/downloads/windows?cpe-name=3.x"
    Write-Host "  2. Extract ngrok.exe to: $NGROK_EXE"
    Write-Host "  3. Run:  ngrok config add-authtoken YOUR_TOKEN"
    Write-Host ""
    exit 1
}

Write-Host "Extracting..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($NGROK_ZIP)
foreach ($entry in $zip.Entries) {
    if ($entry.Name -eq "ngrok.exe") {
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $NGROK_V3, $true)
        break
    }
}
$zip.Dispose()

if (-not (Test-Path $NGROK_V3)) {
    Write-Host "Could not extract ngrok.exe from zip." -ForegroundColor Red
    exit 1
}

# Back up v2 if not already done
if (-not (Test-Path $NGROK_BAK)) {
    Copy-Item -Path $NGROK_EXE -Destination $NGROK_BAK -Force
    Write-Host "Backed up v2 binary." -ForegroundColor Gray
}

# Replace with v3
Copy-Item -Path $NGROK_V3 -Destination $NGROK_EXE -Force
Write-Host "Replaced bundled binary with ngrok v3." -ForegroundColor Green

# Also patch index.js so @expo/ngrok JS is v3 compatible
$NGROK_INDEX = "node_modules\.pnpm\@expo+ngrok@4.1.3\node_modules\@expo\ngrok\index.js"
$NGROK_PROCESS = "node_modules\.pnpm\@expo+ngrok@4.1.3\node_modules\@expo\ngrok\src\process.js"

$PATCHED_INDEX = @'
const { NgrokClient, NgrokClientError } = require("./src/client");
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
    const errStr = String(err.message || "") + String((err.body && err.body.msg) || "") + String(err.body || "");
    if (errStr.includes("already exists")) {
      try {
        const detail = await ngrokClient.tunnelDetail(tunnelOpts.name);
        return detail.public_url;
      } catch (_) {}
    }
    if (!isRetriable(err) || retryCount >= 100) throw err;
    await new Promise(function(resolve) { setTimeout(resolve, 200); });
    return connectRetry(opts, ++retryCount);
  }
}

async function disconnect(publicUrl) {
  if (!ngrokClient) return;
  const tunnels = (await ngrokClient.listTunnels()).tunnels;
  if (!publicUrl) return Promise.all(tunnels.map(function(t) { return disconnect(t.public_url); }));
  const td = tunnels.find(function(t) { return t.public_url === publicUrl; });
  if (!td) throw new Error("there is no tunnel with url: " + publicUrl);
  return ngrokClient.stopTunnel(td.name);
}

async function kill() {
  if (!ngrokClient) return;
  await killProcess();
  ngrokClient = null;
}

function getUrl() { return processUrl; }
function getApi() { return ngrokClient; }

module.exports = { connect, disconnect, authtoken: setAuthtoken, kill, getUrl, getApi, getVersion, getActiveProcess, NgrokClientError };
'@

Set-Content -Path $NGROK_INDEX -Value $PATCHED_INDEX -Encoding UTF8
Write-Host "Patched @expo/ngrok index.js for v3 API." -ForegroundColor Green

# Patch process.js to remove --config flag (v3 doesn't support legacy config path)
if (Test-Path $NGROK_PROCESS) {
    $proc = Get-Content $NGROK_PROCESS -Raw
    $proc = $proc -replace 'if \(opts\.configPath\) start\.push\("--config=" \+ opts\.configPath\);', '// v3: skip legacy --config flag'
    Set-Content -Path $NGROK_PROCESS -Value $proc -Encoding UTF8
    Write-Host "Patched @expo/ngrok process.js." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor Yellow
Write-Host ""
Write-Host "Get your free token at: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Cyan
Write-Host ""
Write-Host "Then: pnpm start" -ForegroundColor Yellow
Write-Host ""
