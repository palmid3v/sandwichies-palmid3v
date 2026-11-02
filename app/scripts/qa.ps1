# Sandwichies QA runner — safe local checks only
[CmdletBinding()]
param(
  [switch]$SkipAudit
)

$ErrorActionPreference = "Stop"
$AppRoot = Split-Path -Parent $PSScriptRoot
Push-Location $AppRoot

try {
  Write-Host "Sandwichies QA — local safe suite" -ForegroundColor Cyan
  Write-Host "Working directory: $AppRoot"
  Write-Host "This runner does not deploy or write to production." -ForegroundColor Green

  $steps = @()
  if (-not $SkipAudit) { $steps += @{ Name = "Dependency audit"; Command = "npm"; Args = @("run", "audit") } }
  $steps += @(
    @{ Name = "Lint"; Command = "npm"; Args = @("run", "lint") },
    @{ Name = "Cloudflare Worker tests"; Command = "npm"; Args = @("run", "worker:test") },
    @{ Name = "Domain/unit tests"; Command = "npm"; Args = @("test") },
    @{ Name = "Firestore rules emulator tests"; Command = "npm"; Args = @("run", "security:test") },
    @{ Name = "Cupboard/integration emulator tests"; Command = "npm"; Args = @("run", "integration:test") },
    @{ Name = "Production build"; Command = "npm"; Args = @("run", "build") },
    @{ Name = "Bundle budget"; Command = "npm"; Args = @("run", "performance:check") },
    @{ Name = "Local HTTP smoke"; Command = "npm"; Args = @("run", "smoke") }
  )

  $results = @()
  foreach ($step in $steps) {
    Write-Host ""
    Write-Host "=== $($step.Name) ===" -ForegroundColor Yellow
    $arguments = $step.Args
    & $step.Command @arguments
    $exitCode = $LASTEXITCODE
    $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
    $results += [pscustomobject]@{ Stage = $step.Name; Status = $status; ExitCode = $exitCode }
    if ($exitCode -ne 0) {
      Write-Host ""
      Write-Host "QA stopped: $($step.Name) failed with exit code $exitCode." -ForegroundColor Red
      break
    }
  }

  Write-Host ""
  Write-Host "=== QA summary ===" -ForegroundColor Cyan
  $results | Format-Table -AutoSize
  if (($results | Where-Object { $_.Status -eq "FAIL" }).Count -gt 0 -or $results.Count -lt $steps.Count) {
    exit 1
  }
  Write-Host "QA LOCAL APROBADO — all configured stages passed." -ForegroundColor Green
}
finally {
  Pop-Location
}
