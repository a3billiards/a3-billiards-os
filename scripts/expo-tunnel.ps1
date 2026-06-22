# Reliable Expo tunnel via ngrok v3 (Expo's built-in --tunnel uses deprecated ngrok v2).
# One-time setup:
#   1. Download ngrok: https://ngrok.com/download
#   2. ngrok config add-authtoken YOUR_TOKEN   (free account at ngrok.com)

param(
  [int]$Port = 8081
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "ERROR: ngrok v3 is not installed or not on PATH." -ForegroundColor Red
  Write-Host ""
  Write-Host "Setup (free):"
  Write-Host "  1. Install from https://ngrok.com/download"
  Write-Host "  2. Sign up at https://ngrok.com"
  Write-Host "  3. ngrok config add-authtoken YOUR_TOKEN"
  Write-Host ""
  exit 1
}

$ngrokProc = $null

function Stop-Ngrok {
  if ($null -ne $ngrokProc -and -not $ngrokProc.HasExited) {
    Stop-Process -Id $ngrokProc.Id -Force -ErrorAction SilentlyContinue
  }
}

try {
  # Stop stale ngrok agents that block new tunnels on the same machine.
  Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500

  Write-Host "Starting ngrok tunnel on port $Port..." -ForegroundColor Cyan
  $ngrokProc = Start-Process -FilePath "ngrok" `
    -ArgumentList @("http", "$Port", "--host-header=localhost") `
    -PassThru `
    -WindowStyle Hidden

  $ngrokUrl = $null
  for ($i = 0; $i -lt 20; $i++) {
    try {
      $resp = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction Stop
      $ngrokUrl = ($resp.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
      if ($ngrokUrl) { break }
    } catch {
      # ngrok API not ready yet
    }
    Start-Sleep -Seconds 1
  }

  if (-not $ngrokUrl) {
    Write-Host ""
    Write-Host "ERROR: ngrok tunnel did not start." -ForegroundColor Red
    Write-Host "  - Run: ngrok config add-authtoken YOUR_TOKEN"
    Write-Host "  - Check https://status.ngrok.com"
    Write-Host "  - Disable VPN / antivirus blocking ngrok"
    Write-Host ""
    exit 1
  }

  Write-Host ""
  Write-Host "Tunnel ready: $ngrokUrl" -ForegroundColor Green
  Write-Host "Open the dev client using the QR / URL Metro prints below." -ForegroundColor Green
  Write-Host ""

  $env:EXPO_PACKAGER_PROXY_URL = $ngrokUrl
  & pnpm exec expo start --dev-client --lan --port $Port
  exit $LASTEXITCODE
} finally {
  Stop-Ngrok
}
