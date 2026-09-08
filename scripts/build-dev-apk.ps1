# Build Android dev-client debug APK with short paths (Windows path-length safe).
# Usage: powershell -File scripts/build-dev-apk.ps1 -App customer-app
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("owner-app", "customer-app", "admin-app")]
  [string]$App
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path $PSScriptRoot -Parent
$BuildRoot = if (Test-Path "C:\a3billiards") { "C:\a3billiards" } else { $RepoRoot }
$AppDir = Join-Path $BuildRoot "apps\$App"
$AndroidDir = Join-Path $AppDir "android"

if (-not (Test-Path $AndroidDir)) {
  throw "Android folder not found. Run pnpm android:dev-prebuild in apps\$App first."
}

# Short paths — avoids Windows 260-char limit.
$env:GRADLE_USER_HOME = "C:\gradle"
$env:TEMP = "C:\tmp"
$env:TMP = "C:\tmp"
$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"
# Prevent picking up a Cursor-sandbox GRADLE_USER_HOME from the parent environment.
Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME, $env:TEMP | Out-Null

Write-Host "Stopping Gradle daemons..."
Push-Location $AndroidDir
try {
  .\gradlew.bat --stop 2>$null
} catch {
  # ignore if no daemon
} finally {
  Pop-Location
}

# Wipe ALL Gradle caches that may contain cursor-sandbox absolute paths.
$cachePaths = @(
  (Join-Path $env:LOCALAPPDATA "Temp\cursor-sandbox-cache"),
  (Join-Path $env:USERPROFILE ".gradle\caches"),
  (Join-Path $env:USERPROFILE ".gradle\daemon"),
  "C:\gradle"
)
foreach ($cachePath in $cachePaths) {
  if (Test-Path $cachePath) {
    Write-Host "Removing $cachePath"
    Remove-Item $cachePath -Recurse -Force -ErrorAction SilentlyContinue
  }
}
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME, $env:TEMP | Out-Null

# CMake/ninja bake absolute prefab paths — clear every .cxx under node_modules.
Write-Host "Clearing native .cxx caches under node_modules..."
Get-ChildItem (Join-Path $BuildRoot "node_modules") -Directory -Recurse -Filter ".cxx" -ErrorAction SilentlyContinue |
  ForEach-Object {
    Write-Host "  Removing $($_.FullName)"
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
  }

$localCxx = @(
  (Join-Path $AndroidDir "app\.cxx"),
  (Join-Path $AndroidDir ".gradle"),
  (Join-Path $AndroidDir "build")
)
foreach ($path in $localCxx) {
  if (Test-Path $path) {
    Write-Host "Removing $path"
    Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Building dev APK for $App (GRADLE_USER_HOME=$env:GRADLE_USER_HOME)"
Push-Location $AndroidDir
try {
  .\gradlew.bat clean assembleDebug --no-build-cache --no-daemon --max-workers=2
} finally {
  Pop-Location
}

$apk = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apk) {
  Write-Host ""
  Write-Host "Dev APK ready:" -ForegroundColor Green
  Write-Host $apk
} else {
  throw "Build finished but APK not found at $apk"
}
