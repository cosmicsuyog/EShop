param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$NxCommand,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$NxArguments
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Set-LocalDatabaseEnvironment.ps1')
Push-Location $repoRoot
try {
  & npx nx $NxCommand @NxArguments
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
