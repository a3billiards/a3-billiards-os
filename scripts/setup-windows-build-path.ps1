# One-time: copy repo to C:\a3\billiards for local Android builds on Windows.
# Run from any copy of the repo. Safe to re-run (refreshes source, keeps .env.local).

$ErrorActionPreference = "Stop"
$src = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dst = "C:\a3\billiards"

Write-Host "Source: $src"
Write-Host "Target: $dst"
Write-Host ""

New-Item -ItemType Directory -Force -Path "C:\a3" | Out-Null

if ($src -eq $dst) {
  Write-Host "Already at $dst. Run: pnpm install, then pnpm android:win" -ForegroundColor Green
  exit 0
}

robocopy $src $dst /MIR /XD node_modules android .gradle .expo .turbo /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null
if ($LASTEXITCODE -ge 8) {
  Write-Host "robocopy failed with exit code $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Copied to $dst" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  cd C:\a3\billiards"
Write-Host "  pnpm install"
Write-Host "  cd apps\owner-app"
Write-Host "  pnpm android:win"
Write-Host ""
Write-Host "Open C:\a3\billiards in Cursor for local Android work." -ForegroundColor Cyan
