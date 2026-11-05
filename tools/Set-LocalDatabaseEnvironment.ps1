$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$localEnvironmentPath = Join-Path $repoRoot '.env.local'
if (-not (Test-Path -LiteralPath $localEnvironmentPath -PathType Leaf)) {
  throw 'Missing .env.local. Copy .env.example and configure the isolated local database first.'
}

$databaseLine = Get-Content -LiteralPath $localEnvironmentPath | Where-Object {
  $_ -match '^\s*DATABASE_URL\s*='
} | Select-Object -Last 1
if (-not $databaseLine) {
  throw '.env.local must define DATABASE_URL for the isolated development database.'
}

$databaseUrl = ($databaseLine.Substring($databaseLine.IndexOf('=') + 1)).Trim()
if ($databaseUrl.Length -ge 2 -and (($databaseUrl.StartsWith('"') -and $databaseUrl.EndsWith('"')) -or ($databaseUrl.StartsWith("'") -and $databaseUrl.EndsWith("'")))) {
  $databaseUrl = $databaseUrl.Substring(1, $databaseUrl.Length - 2)
}

$databaseMatch = [regex]::Match(
  $databaseUrl,
  '^mongodb://(?<authority>[^/?#]+)(?<database>/[^?]*)?(?:\?(?<query>.*))?$'
)
if (-not $databaseMatch.Success -or
    $databaseMatch.Groups['authority'].Value -cne '127.0.0.1:27018' -or
    $databaseMatch.Groups['database'].Value -cne '/eshop_development') {
  throw 'Refusing Prisma/Nx execution: DATABASE_URL must target 127.0.0.1:27018/eshop_development.'
}

$replicaSet = $null
foreach ($parameter in $databaseMatch.Groups['query'].Value.Split('&')) {
  $parts = $parameter -split '=', 2
  if ($parts.Length -eq 2 -and $parts[0] -ceq 'replicaSet') {
    $replicaSet = [Uri]::UnescapeDataString($parts[1])
  }
}
if ($replicaSet -cne 'eshop-dev') {
  throw 'Refusing Prisma/Nx execution: DATABASE_URL must use replica set eshop-dev.'
}

$allowedLocalKeys = @(
  'DATABASE_URL', 'REDIS_DATABASE_URL', 'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET', 'USER_UI_ORIGIN', 'SELLER_UI_ORIGIN',
  'NEXT_PUBLIC_API_GATEWAY_URL', 'API_GATEWAY_URL',
  'NEXT_PUBLIC_USER_UI_URL', 'NEXT_PUBLIC_SELLER_UI_URL',
  'AUTH_SERVICE_URL', 'PRODUCT_SERVICE_URL', 'SMTP_HOST', 'SMTP_PORT',
  'SMTP_SERVICE', 'SMTP_USER', 'SMTP_PASS', 'IMAGEKIT_PRIVATE_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_REFRESH_URL',
  'STRIPE_RETURN_URL'
)
foreach ($line in Get-Content -LiteralPath $localEnvironmentPath) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
    $key = $matches[1]
    if ($allowedLocalKeys -ccontains $key) {
      $value = $matches[2].Trim()
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
  }
}

# Set the validated value last so dotenv loading cannot replace it with the
# legacy root .env value or a previously inherited environment variable.
[Environment]::SetEnvironmentVariable('DATABASE_URL', $databaseUrl, 'Process')
