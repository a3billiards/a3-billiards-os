<#
.SYNOPSIS
  Generate android/ via expo prebuild (per app), run Gradle signingReport, print SHA1 lines
  plus the Windows debug keystore SHA-1 for Google Cloud Android OAuth clients.

.NOTES
  Run from PowerShell:
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\scripts\Collect-AndroidSha1.ps1

  From monorepo root (a3-billiards-os):
    .\scripts\Collect-AndroidSha1.ps1

  - Creates apps\<customer-app|owner-app>\android\ (generated only; safe to delete after).
  - Does not edit app.config.ts / eas.json.
  - EAS preview/production SHA-1: run `eas credentials -p android` from each app folder (see script footer).
#>

$ErrorActionPreference = "Stop"

$MonorepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$Apps = @(
  @{ Name = "customer-app"; PackageHint = "com.a3billiards.customerapp" },
  @{ Name = "owner-app";    PackageHint = "com.a3billiards.ownerapp" }
)

function Write-Banner([string]$Text) {
  Write-Host ""
  Write-Host ("=" * 72) -ForegroundColor Cyan
  Write-Host $Text -ForegroundColor Cyan
  Write-Host ("=" * 72) -ForegroundColor Cyan
}

Write-Host "Monorepo root: $MonorepoRoot" -ForegroundColor DarkGray

Write-Banner "1) Windows DEBUG keystore SHA-1 (shared by local Gradle debug builds)"
$DebugKs = Join-Path $env:USERPROFILE ".android\debug.keystore"
if (-not (Test-Path -LiteralPath $DebugKs)) {
  Write-Warning "Debug keystore not found at: $DebugKs (build any Android debug app once, or create via Android Studio)."
} else {
  & keytool -list -v `
    -keystore $DebugKs `
    -alias androiddebugkey `
    -storepass android `
    -keypass android `
  | Select-String -Pattern "SHA1:"
}

foreach ($app in $Apps) {
  $appDir = Join-Path $MonorepoRoot ("apps\" + $app.Name)
  if (-not (Test-Path -LiteralPath $appDir)) {
    throw "App folder not found: $appDir"
  }

  Write-Banner ("2) EXPO PREBUILD — " + $app.Name + " (" + $app.PackageHint + ")")
  Push-Location $appDir
  try {
    npx expo prebuild --platform android

    $androidDir = Join-Path $appDir "android"
    if (-not (Test-Path -LiteralPath $androidDir)) {
      throw "Expected android folder missing: $androidDir"
    }

    Write-Banner ("3) GRADLE signingReport — " + $app.Name)
    Push-Location $androidDir
    try {
      if (Test-Path -LiteralPath ".\gradlew.bat") {
        .\gradlew.bat signingReport 2>&1 |
          Select-String -Pattern "SHA1:" |
          ForEach-Object { "{0} [{1}]" -f $_.Line.Trim(), $app.Name }
      } else {
        throw "gradlew.bat not found under $androidDir"
      }
    } finally {
      Pop-Location
    }
  } finally {
    Pop-Location
  }
}

Write-Banner "DONE — copy all SHA1: lines above into Google Cloud → APIs & Services → Credentials → Android OAuth client"
Write-Host "Package names:" -ForegroundColor Yellow
$Apps | ForEach-Object { Write-Host ("  - {0}  ({1})" -f $_.PackageHint, $_.Name) }
Write-Host ""
Write-Host "EAS preview / production SHA-1 (manual, per app + profile):" -ForegroundColor Yellow
Write-Host "  cd apps\customer-app   ; eas credentials -p android"
Write-Host "  cd apps\owner-app      ; eas credentials -p android"
Write-Host "Or: https://expo.dev → project → Credentials → Android → preview / production keystore → SHA-1"
Write-Host ""
Write-Host "Optional cleanup (removes generated native folders):" -ForegroundColor DarkGray
Write-Host "  Remove-Item -Recurse -Force apps\customer-app\android, apps\owner-app\android"
