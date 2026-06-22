# Android native builds (Gradle/CMake) fail on Windows when the project path contains spaces.
# EAS cloud builds are unaffected - this guard is for local expo run:android only.

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ($root -match "\s") {
  Write-Host ""
  Write-Host "ERROR: Project path contains spaces (Android local build will fail on Windows):" -ForegroundColor Red
  Write-Host "  $root" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Run scripts/setup-windows-build-path.ps1 and use C:\a3\billiards" -ForegroundColor Cyan
  Write-Host ""
  exit 1
}

exit 0
