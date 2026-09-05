param(
    [string]$BaseUrl = "",
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
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$matches[1]] = $value
        }
    }
    return $values
}

function Get-Value($Values, [string]$Name) {
    if ($Values.ContainsKey($Name)) { return [string]$Values[$Name] }
    $environmentValue = [Environment]::GetEnvironmentVariable($Name)
    if ($environmentValue) { return [string]$environmentValue }
    return ""
}

try {
    $envValues = Read-DotEnv (Join-Path $ProjectPath ".env.local")
    if ($envValues.Count -eq 0) { $envValues = Read-DotEnv (Join-Path $ProjectPath ".env") }

    $secret = Get-Value $envValues "AUTOMATION_CRON_SECRET"
    $dryRun = Get-Value $envValues "AUTOMATION_DRY_RUN"
    if ([string]::IsNullOrWhiteSpace($secret) -or $secret.Length -lt 32) { throw "AUTOMATION_CRON_SECRET is missing or shorter than 32 characters." }
    if ($dryRun.ToLowerInvariant() -ne "true") { throw "Safety stop: AUTOMATION_DRY_RUN must be true for this script." }

    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        foreach ($candidate in @("http://localhost:3000", "http://localhost:3001")) {
            try {
                $health = Invoke-WebRequest -UseBasicParsing -Uri ($candidate + "/api/health") -TimeoutSec 8
                if ($health.StatusCode -ge 200 -and $health.StatusCode -lt 300) { $BaseUrl = $candidate; break }
            } catch { }
        }
    }
    if ([string]::IsNullOrWhiteSpace($BaseUrl)) { throw "No healthy AllJobsIndia server found on localhost:3000 or localhost:3001." }
    $BaseUrl = $BaseUrl.TrimEnd('/')

    $headers = @{ Authorization = "Bearer $secret" }
    $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri ($BaseUrl + "/api/automation/cron") -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 180
    $envelope = $response.Content | ConvertFrom-Json
    if (-not $envelope.success -or -not $envelope.result) { throw "Cron endpoint returned an unsuccessful response." }
    $result = $envelope.result
    Write-Host "AllJobsIndia automation dry-run completed"
    Write-Host ("Server: {0}" -f $BaseUrl)
    Write-Host ("Run status: {0}" -f $result.status)
    Write-Host ("Sources: {0}, candidates: {1}, would-add: {2}, errors: {3}" -f $result.sourcesChecked, $result.candidates, $result.wouldAdd, $result.errors)
    Write-Host "Safety: no Job write, auto-publish remains disabled. A dry-run audit row may be recorded."
} catch {
    Write-Error ("Automation dry-run failed: " + $_.Exception.Message)
    exit 1
} finally {
    if ($Pause) { Read-Host "Press Enter to close" | Out-Null }
}
