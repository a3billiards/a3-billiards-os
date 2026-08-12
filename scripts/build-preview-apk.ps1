# Build Android preview (release) APK — standalone app, no Metro/dev client required.
# Usage: powershell -File scripts/build-preview-apk.ps1 -App owner-app
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("owner-app", "customer-app", "admin-app")]
  [string]$App,
  [switch]$SkipSync
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path $PSScriptRoot -Parent
$BuildRoot = if (Test-Path "C:\a3billiards") { "C:\a3billiards" } else { $RepoRoot }

# Always build from the latest workspace code (C:\a3billiards is a short-path mirror).
if (-not $SkipSync -and $BuildRoot -ne $RepoRoot) {
  Write-Host "Syncing latest code from workspace -> $BuildRoot" -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot "sync-to-build-folder.ps1")
}

$AppDir = Join-Path $BuildRoot "apps\$App"
$AndroidDir = Join-Path $AppDir "android"
$EasPath = Join-Path $AppDir "eas.json"
$DistDir = Join-Path $BuildRoot "dist\preview-apks"

if (-not (Test-Path $EasPath)) {
  throw "eas.json not found at $EasPath"
}

$eas = Get-Content $EasPath -Raw | ConvertFrom-Json
$previewEnv = $eas.build.preview.env
if ($null -eq $previewEnv) {
  throw "No build.preview.env in $EasPath"
}

# Preview = standalone release build (not dev client).
Remove-Item Env:EAS_BUILD_PROFILE -ErrorAction SilentlyContinue
$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"
$env:NODE_ENV = "production"

foreach ($prop in $previewEnv.PSObject.Properties) {
  $name = $prop.Name
  $value = [string]$prop.Value
  if ($value.Length -gt 0) {
    Set-Item -Path "env:$name" -Value $value
  }
}

if ([string]::IsNullOrWhiteSpace($env:EXPO_PUBLIC_CONVEX_URL)) {
  throw "EXPO_PUBLIC_CONVEX_URL is not set. Check eas.json preview env for $App."
}

Write-Host "=== Preview APK: $App ===" -ForegroundColor Cyan
Write-Host "Convex: $($env:EXPO_PUBLIC_CONVEX_URL)"
Write-Host "App dir: $AppDir"

# Short paths — avoids Windows 260-char limit.
$env:GRADLE_USER_HOME = "C:\gradle"
$env:TEMP = "C:\tmp"
$env:TMP = "C:\tmp"
Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME, $env:TEMP, $DistDir | Out-Null

Write-Host "Running expo prebuild (android, clean)..."
if (Test-Path (Join-Path $AndroidDir "gradlew.bat")) {
  Write-Host "Stopping Gradle daemons before prebuild..."
  Push-Location $AndroidDir
  try {
    .\gradlew.bat --stop 2>$null
  } catch {
    # ignore
  } finally {
    Pop-Location
  }
  Start-Sleep -Seconds 3
}

Push-Location $AppDir
try {
  npx expo prebuild --platform android --clean
} finally {
  Pop-Location
}

if (-not (Test-Path $AndroidDir)) {
  throw "Android folder not found after prebuild: $AndroidDir"
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

Write-Host "Building release APK (assembleRelease)..."
Push-Location $AndroidDir
try {
  .\gradlew.bat clean assembleRelease --no-build-cache --no-daemon --max-workers=2
} finally {
  Pop-Location
}

$candidates = @(
  (Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"),
  (Join-Path $AndroidDir "app\build\outputs\apk\release\app-release-unsigned.apk")
)
$apk = $null
foreach ($candidate in $candidates) {
  if (Test-Path $candidate) {
    $apk = $candidate
    break
  }
}
if (-not $apk) {
  throw "Build finished but release APK not found under app\build\outputs\apk\release\"
}

$shortName = $App -replace "-app$", ""
$dest = Join-Path $DistDir "$shortName-preview.apk"
Copy-Item $apk $dest -Force

# Mirror APK into the main repo when building from the short-path folder.
if ($BuildRoot -ne $RepoRoot) {
  $repoDist = Join-Path $RepoRoot "dist\preview-apks"
  New-Item -ItemType Directory -Force -Path $repoDist | Out-Null
  Copy-Item $dest (Join-Path $repoDist "$shortName-preview.apk") -Force
}

Write-Host ""
Write-Host "Preview APK ready:" -ForegroundColor Green
Write-Host $dest
if ($BuildRoot -ne $RepoRoot) {
  Write-Host (Join-Path $RepoRoot "dist\preview-apks\$shortName-preview.apk")
}
Write-Host "Source:" $apk
