# Local Android dev-client build on Windows.
# Requires: short path with NO spaces (e.g. C:\a3\billiards), Android SDK, JDK 17.

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ($root -match "\s") {
  Write-Host "ERROR: Path has spaces. Use C:\a3\billiards (see scripts/setup-windows-build-path.ps1)." -ForegroundColor Red
  exit 1
}

$env:EAS_BUILD_PROFILE = "development"
$env:GRADLE_USER_HOME = "C:\gradle-cache"
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }

New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null

$ownerApp = Join-Path $root "apps\owner-app"
$androidDir = Join-Path $ownerApp "android"

Write-Host "Project: $root"
Write-Host "Gradle cache: $env:GRADLE_USER_HOME"
Write-Host ""

if (Test-Path $androidDir) {
  Write-Host "Cleaning android build folders..."
  Remove-Item -Recurse -Force (Join-Path $androidDir "app\build") -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $androidDir "app\.cxx") -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $androidDir "build") -ErrorAction SilentlyContinue
  Get-ChildItem -Path (Join-Path $root "node_modules") -Recurse -Directory -Filter "cxx" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Push-Location $ownerApp
try {
  pnpm android
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
