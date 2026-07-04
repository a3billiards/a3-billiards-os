# Pull build-only assets from C:\a3billiards into the main repo.
# Usage: powershell -File scripts/sync-from-build-folder.ps1

$ErrorActionPreference = "Stop"

$MainRoot = Split-Path $PSScriptRoot -Parent
$BuildRoot = "C:\a3billiards"

if (-not (Test-Path $BuildRoot)) {
  throw "Build folder not found: $BuildRoot"
}

foreach ($app in @("owner-app", "customer-app", "admin-app")) {
  $buildApp = Join-Path $BuildRoot "apps\$app"
  $mainApp = Join-Path $MainRoot "apps\$app"

  $envSource = Join-Path $buildApp ".env.local"
  if (Test-Path $envSource) {
    Copy-Item $envSource (Join-Path $mainApp ".env.local") -Force
    Write-Host "Synced .env.local -> $app"
  }

  $assetsSource = Join-Path $buildApp "assets"
  if (Test-Path $assetsSource) {
    Copy-Item $assetsSource (Join-Path $mainApp "assets") -Recurse -Force
    Write-Host "Synced assets -> $app"
  }
}

Write-Host "Done."
