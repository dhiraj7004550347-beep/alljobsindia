param(
    [string]$ProjectPath = (Split-Path -Parent $PSScriptRoot),
    [switch]$Pause
)

$ErrorActionPreference = "Stop"
function Read-DotEnv([string]$Path) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $values }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            $value = $matches[2].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
            $values[$matches[1]] = $value
        }
    }
    return $values
}
try {
    $values = Read-DotEnv (Join-Path $ProjectPath ".env.local")
    if ($values.Count -eq 0) { $values = Read-DotEnv (Join-Path $ProjectPath ".env") }
    $required = @("DATABASE_URL", "NEXT_PUBLIC_SITE_URL", "ADMIN_SECRET", "AUTOMATION_CRON_SECRET")
    $missing = @($required | Where-Object { -not $values.ContainsKey($_) -or [string]::IsNullOrWhiteSpace([string]$values[$_]) })
    if ($missing.Count -gt 0) { throw ("Missing required values: " + ($missing -join ", ")) }
    if (-not ([Uri]$values["NEXT_PUBLIC_SITE_URL"]).IsAbsoluteUri -or ([Uri]$values["NEXT_PUBLIC_SITE_URL"]).Scheme -ne "https") { throw "NEXT_PUBLIC_SITE_URL must be an absolute HTTPS URL in production." }
    foreach ($name in @("ADMIN_SECRET", "AUTOMATION_CRON_SECRET")) { if ([string]$values[$name].Length -lt 32) { throw "$name must be at least 32 characters." } }
    foreach ($name in @("AUTOMATION_ALLOW_WRITE_RUNS", "AUTOMATION_ALLOW_MANUAL_DRAFTS", "AUTOMATION_ALLOW_REVIEW_DECISIONS", "AUTOMATION_ALLOW_AUTO_PUBLISH")) {
        if ($values.ContainsKey($name) -and [string]$values[$name].ToLowerInvariant() -eq "true") { throw "$name must remain false until launch approval." }
    }
    if ($values.ContainsKey("AUTOMATION_DRY_RUN") -and [string]$values["AUTOMATION_DRY_RUN"].ToLowerInvariant() -ne "true") { throw "AUTOMATION_DRY_RUN must remain true during validation." }
    Write-Host "Production environment safety validation passed (code-only; no database connection made)."
} catch {
    Write-Error ("Production environment validation failed: " + $_.Exception.Message)
    exit 1
} finally {
    if ($Pause) { Read-Host "Press Enter to close" | Out-Null }
}
