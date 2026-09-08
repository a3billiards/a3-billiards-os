# Copy code from the main repo to C:\a3billiards before building APKs.
# Run after every feature batch:  pnpm sync:build-folder
# Usage: powershell -File scripts/sync-to-build-folder.ps1
#
# Uses -LiteralPath everywhere so Expo dynamic routes like [clubId].tsx sync correctly
# (PowerShell treats [...] as wildcards in normal -Path parameters).

$ErrorActionPreference = "Stop"

$MainRoot = Split-Path $PSScriptRoot -Parent
$BuildRoot = "C:\a3billiards"

if (-not (Test-Path -LiteralPath $BuildRoot)) {
  throw "Build folder not found: $BuildRoot"
}

$excludeDirs = @(
  "node_modules",
  "android",
  "ios",
  ".expo",
  ".gradle",
  "build",
  ".cxx",
  "dist",
  ".turbo"
)

function Sync-Tree {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    return
  }

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null

  Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
    if ($excludeDirs -contains $_.Name) {
      return
    }

    $target = Join-Path $Destination $_.Name
    if ($_.PSIsContainer) {
      Sync-Tree -Source $_.FullName -Destination $target
    } else {
      Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
  }

  # Remove destination files/dirs deleted from the main repo (one-way mirror).
  if (Test-Path -LiteralPath $Destination) {
    Get-ChildItem -LiteralPath $Destination -Force | ForEach-Object {
      if ($excludeDirs -contains $_.Name) {
        return
      }
      $sourceItem = Join-Path $Source $_.Name
      if (-not (Test-Path -LiteralPath $sourceItem)) {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
      }
    }
  }
}

Write-Host "Syncing main repo -> $BuildRoot"

@(
  "apps",
  "packages",
  "scripts",
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.json"
) | ForEach-Object {
  $source = Join-Path $MainRoot $_
  $destination = Join-Path $BuildRoot $_
  if (Test-Path -LiteralPath $source -PathType Container) {
    Sync-Tree -Source $source -Destination $destination
    Write-Host "  synced dir $_"
  } elseif (Test-Path -LiteralPath $source -PathType Leaf) {
    Copy-Item -LiteralPath $source -Destination $destination -Force
    Write-Host "  synced file $_"
  }
}

Write-Host "Done. Build APKs from $BuildRoot\apps\<app-name>"
