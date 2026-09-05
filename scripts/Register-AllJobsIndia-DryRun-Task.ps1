param(
    [string]$TaskName = "AllJobsIndia-Automation-DryRun",
    [string]$ProjectPath = (Split-Path -Parent $PSScriptRoot),
    [string]$BaseUrl = "http://localhost:3000",
    [ValidateRange(1, 24)][int]$EveryHours = 12,
    [switch]$ConfirmRegistration
)

$ErrorActionPreference = "Stop"
$runner = Join-Path $ProjectPath "scripts\AllJobsIndia-Automation-DryRun.ps1"
if (-not (Test-Path -LiteralPath $runner)) { throw "Runner not found: $runner" }
if (-not $ConfirmRegistration) {
    Write-Host "Preview only. Re-run with -ConfirmRegistration to create this Windows Task Scheduler entry."
    Write-Host ("Task: {0}; interval: every {1} hours; URL: {2}" -f $TaskName, $EveryHours, $BaseUrl)
    exit 0
}

$taskRun = 'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $runner + '" -BaseUrl "' + $BaseUrl + '"'
& schtasks.exe /Create /SC HOURLY /MO $EveryHours /TN $TaskName /TR $taskRun /F
if ($LASTEXITCODE -ne 0) { throw "Task Scheduler registration failed with exit code $LASTEXITCODE." }
Write-Host ("Registered '{0}' for a dry-run every {1} hours." -f $TaskName, $EveryHours)
Write-Host "The task cannot create Jobs while AUTOMATION_DRY_RUN=true and write gates are off."
