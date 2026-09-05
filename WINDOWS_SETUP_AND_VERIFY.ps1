$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " AllJobsIndia MASTER - Setup & Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$oldProject = Join-Path $env:USERPROFILE "Downloads\alljobsindia_build1"

foreach ($envName in @(".env", ".env.local")) {
    $target = Join-Path $PSScriptRoot $envName
    $source = Join-Path $oldProject $envName

    if (-not (Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $source)) {
        Copy-Item -LiteralPath $source -Destination $target -Force
        Write-Host "[PASS] Copied private $envName from old working project." -ForegroundColor Green
    }
}

if (-not (Test-Path -LiteralPath ".env") -and -not (Test-Path -LiteralPath ".env.local")) {
    Write-Host "[WARNING] No .env/.env.local found." -ForegroundColor Yellow
    Write-Host "Copy your private environment values before starting the site." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[1/6] Installing packages..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] npm install failed." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "[2/6] Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Prisma generate failed." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "[3/6] Running tests..." -ForegroundColor Yellow
npm test

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Tests failed." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "[4/6] TypeScript verification..." -ForegroundColor Yellow
npx tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] TypeScript check failed." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "[5/6] Lint verification..." -ForegroundColor Yellow
npm run lint

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Lint failed." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "[6/6] Production build..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Production build failed." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " MASTER VERIFICATION PASSED" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "No database migration or delete command was run." -ForegroundColor Green
Write-Host "Start the verified site with:" -ForegroundColor Cyan
Write-Host "npm run start" -ForegroundColor White
Write-Host ""
