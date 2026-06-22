# Stops stale ngrok agents and Metro on 8081/8082 left from a previous pnpm start.
# Wired as "prestart" so plain `pnpm start` works without manual cleanup.

$ErrorActionPreference = "SilentlyContinue"

foreach ($port in 8081, 8082) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
      if ($proc -and $proc.ProcessName -eq "node") {
        Stop-Process -Id $proc.Id -Force
      }
    }
}

Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Milliseconds 800
