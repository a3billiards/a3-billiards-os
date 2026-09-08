# Build preview APKs for owner, customer, and admin apps sequentially.
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path $ScriptDir -Parent
$BuildRoot = if (Test-Path "C:\a3billiards") { "C:\a3billiards" } else { $RepoRoot }

if ($BuildRoot -ne $RepoRoot) {
  Write-Host "Syncing workspace -> $BuildRoot" -ForegroundColor Cyan
  & (Join-Path $ScriptDir "sync-to-build-folder.ps1")
  Write-Host "Installing dependencies in $BuildRoot..." -ForegroundColor Cyan
  Push-Location $BuildRoot
  try {
    pnpm install
  } finally {
    Pop-Location
  }
}

$apps = @("owner-app", "customer-app", "admin-app")
$failed = @()

foreach ($app in $apps) {
  Write-Host ""
  Write-Host "############################################" -ForegroundColor Yellow
  Write-Host "# Building $app" -ForegroundColor Yellow
  Write-Host "############################################" -ForegroundColor Yellow
  try {
    & (Join-Path $ScriptDir "build-preview-apk.ps1") -App $app -SkipSync
  } catch {
    Write-Host "FAILED: $app - $_" -ForegroundColor Red
    $failed += $app
  }
}

Write-Host ""
if ($failed.Count -eq 0) {
  Write-Host "All preview APKs built successfully." -ForegroundColor Green
  Write-Host "Output folder: dist\preview-apks\" -ForegroundColor Green
} else {
  $failedList = $failed -join ", "
  Write-Host "Failed apps: $failedList" -ForegroundColor Red
  exit 1
}
