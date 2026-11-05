param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('validate', 'generate', 'db')]
  [string]$PrismaCommand,

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$PrismaArguments
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'Set-LocalDatabaseEnvironment.ps1')
Push-Location $repoRoot
try {
  $arguments = @($PrismaCommand) + @($PrismaArguments) + @('--schema', 'prisma/schema.prisma')
  & npx prisma @arguments
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
