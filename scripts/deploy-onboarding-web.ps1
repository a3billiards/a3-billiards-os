# Deploy onboarding website to Vercel (register.a3billiards.com).
# Prerequisites: `npx vercel login` once, or set VERCEL_TOKEN in the environment.
#
# Usage (from repo root):
#   pnpm deploy:onboarding-web
#   pnpm deploy:onboarding-web -Production

param(
  [switch]$Production
)

$ErrorActionPreference = "Stop"
$VercelScope = "a3billiards-1339s-projects"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$AppDir = Join-Path $RepoRoot "apps\onboarding-web"

if (-not (Test-Path (Join-Path $AppDir ".env.local"))) {
  Write-Host "Missing apps/onboarding-web/.env.local - copy from .env.example and set VITE_CONVEX_URL." -ForegroundColor Red
  exit 1
}

# Load VITE_* from .env.local for the production build.
Get-Content (Join-Path $AppDir ".env.local") | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { return }
  $name = $Matches[1]
  $value = $Matches[2].Trim().Trim('"').Trim("'")
  if ($name.StartsWith("VITE_")) {
    Set-Item -Path "env:$name" -Value $value
  }
}

if ([string]::IsNullOrWhiteSpace($env:VITE_CONVEX_URL)) {
  throw "VITE_CONVEX_URL is not set in apps/onboarding-web/.env.local"
}

Write-Host "Building onboarding web (Convex: $env:VITE_CONVEX_URL)..." -ForegroundColor Cyan
Push-Location $AppDir
try {
  if (-not (Test-Path ".vercel\project.json")) {
    npx vercel link --yes --scope $VercelScope --project onboarding-web
  }
  pnpm build
  npx vercel build --yes --scope $VercelScope
} finally {
  Pop-Location
}

Write-Host "Deploying to Vercel (scope: $VercelScope)..." -ForegroundColor Cyan
Push-Location $AppDir
try {
  $deployArgs = @("deploy", "--prebuilt", "--yes", "--scope", $VercelScope)
  if ($Production) {
    $deployArgs += "--prod"
  }
  npx vercel @deployArgs
} finally {
  Pop-Location
}

if ($Production) {
  Write-Host ""
  Write-Host "Convex ONBOARDING_WEB_URL should be https://register.a3billiards.com" -ForegroundColor Yellow
  Write-Host "Add custom domain register.a3billiards.com in Vercel onboarding-web project settings." -ForegroundColor Yellow
}
