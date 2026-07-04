# Copy code from the main repo to C:\a3billiards before building APKs.
# Run after every feature batch:  pnpm sync:build-folder
# Usage: powershell -File scripts/sync-to-build-folder.ps1

$ErrorActionPreference = "Stop"

$MainRoot = Split-Path $PSScriptRoot -Parent
$BuildRoot = "C:\a3billiards"

if (-not (Test-Path $BuildRoot)) {
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

  if (-not (Test-Path $Source)) {
    return
  }

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null

  Get-ChildItem -Path $Source -Force | ForEach-Object {
    if ($excludeDirs -contains $_.Name) {
      return
    }

    $target = Join-Path $Destination $_.Name
    if ($_.PSIsContainer) {
      Sync-Tree -Source $_.FullName -Destination $target
    } else {
      Copy-Item $_.FullName $target -Force
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
  if (Test-Path $source -PathType Container) {
    Sync-Tree -Source $source -Destination $destination
    Write-Host "  synced dir $_"
  } elseif (Test-Path $source -PathType Leaf) {
    Copy-Item $source $destination -Force
    Write-Host "  synced file $_"
  }
}

Write-Host "Done. Build APKs from $BuildRoot\apps\<app-name>"
