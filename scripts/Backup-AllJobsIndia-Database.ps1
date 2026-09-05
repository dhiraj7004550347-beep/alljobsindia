param(
    [string]$ProjectPath = (Split-Path -Parent $PSScriptRoot),
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) "backups")
)

$ErrorActionPreference = "Stop"

function Read-DatabaseUrl([string]$Path) {
    foreach ($file in @((Join-Path $Path ".env.local"), (Join-Path $Path ".env"))) {
        if (-not (Test-Path -LiteralPath $file)) { continue }
        foreach ($line in Get-Content -LiteralPath $file) {
            if ($line -match '^\s*DATABASE_URL\s*=\s*["'']?(.*?)["'']?\s*$') { return $matches[1].Trim() }
        }
    }
    return ""
}

$databaseUrl = Read-DatabaseUrl $ProjectPath
if ([string]::IsNullOrWhiteSpace($databaseUrl)) { throw "DATABASE_URL was not found in .env.local or .env." }
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) { throw "pg_dump is not installed or is not on PATH." }

$uri = [Uri]$databaseUrl
if ($uri.Scheme -notin @("postgres", "postgresql")) { throw "DATABASE_URL must be a PostgreSQL connection URL." }
$parts = $uri.UserInfo.Split(":", 2)
if ($parts.Count -ne 2) { throw "DATABASE_URL must include a username and password for a safe pg_dump invocation." }
$username = [Uri]::UnescapeDataString($parts[0])
$password = [Uri]::UnescapeDataString($parts[1])
$database = $uri.AbsolutePath.TrimStart('/')
if ([string]::IsNullOrWhiteSpace($database)) { throw "DATABASE_URL has no database name." }

if (-not (Test-Path -LiteralPath $OutputDirectory)) { New-Item -ItemType Directory -Path $OutputDirectory | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDirectory ("alljobsindia-{0}.dump" -f $stamp)
$oldPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $password
    $pgArgs = @("--host", $uri.Host, "--port", $(if ($uri.Port -gt 0) { $uri.Port } else { 5432 }), "--username", $username, "--dbname", $database, "--format", "custom", "--file", $output)
    & $pgDump.Source @pgArgs
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
} finally {
    $env:PGPASSWORD = $oldPassword
}
Write-Host ("Database backup created: {0}" -f $output)
Write-Host "This is a read-only database export; no rows or settings were changed."
