# Fix and Test Web Search - PowerShell Script
# This script ensures the backend is using the correct code

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Web Search Fix & Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill any running backend processes
Write-Host "Step 1: Stopping any running backend processes..." -ForegroundColor Yellow
$nodePIDs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
    $_.Path -like "*enablenext*" 
} | Select-Object -ExpandProperty Id

if ($nodePIDs) {
    Write-Host "Found running Node processes: $($nodePIDs -join ', ')" -ForegroundColor Yellow
    foreach ($pid in $nodePIDs) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped process: $pid" -ForegroundColor Green
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "  No running processes found" -ForegroundColor Green
}

# Step 2: Clear Node cache
Write-Host "`nStep 2: Clearing Node cache..." -ForegroundColor Yellow
if (Test-Path "node_modules/.cache") {
    Remove-Item "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Cache cleared" -ForegroundColor Green
} else {
    Write-Host "  No cache to clear" -ForegroundColor Green
}

# Step 3: Verify the TypeScript fix
Write-Host "`nStep 3: Verifying TypeScript source code..." -ForegroundColor Yellow
$tsFile = "packages\api\src\endpoints\anthropic\llm.ts"
$content = Get-Content $tsFile -Raw

if ($content -match "const tools: Array<\{ type: string; name: string \}> = \[\];") {
    Write-Host "  ✓ TypeScript source is correct (empty tools array)" -ForegroundColor Green
} else {
    Write-Host "  ✗ TypeScript source needs fixing!" -ForegroundColor Red
    exit 1
}

if ($content -match "// if \(enableWebSearch\) \{") {
    Write-Host "  ✓ Native web search is commented out" -ForegroundColor Green
} else {
    Write-Host "  ✗ Native web search is NOT commented out!" -ForegroundColor Red
    exit 1
}

# Step 4: Rebuild the API package
Write-Host "`nStep 4: Rebuilding API package..." -ForegroundColor Yellow
Push-Location "packages\api"
try {
    $buildOutput = npm run build 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Build successful" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Build failed!" -ForegroundColor Red
        Write-Host $buildOutput -ForegroundColor Red
        Pop-Location
        exit 1
    }
} finally {
    Pop-Location
}

# Step 5: Verify compiled JavaScript
Write-Host "`nStep 5: Verifying compiled JavaScript..." -ForegroundColor Yellow
$jsFile = "packages\api\dist\index.js"
$jsContent = Get-Content $jsFile -Raw

if ($jsContent -match "//\s*type:\s*'web_search_20250305'") {
    Write-Host "  ✓ Compiled code has web_search commented out" -ForegroundColor Green
} else {
    Write-Host "  ✗ Compiled code may still have active web_search!" -ForegroundColor Red
}

# Step 6: Start backend
Write-Host "`nStep 6: Starting backend..." -ForegroundColor Yellow
Write-Host "  Starting backend in new window..." -ForegroundColor Cyan
Write-Host "  Please wait 10 seconds for backend to initialize..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run backend:dev"
Start-Sleep -Seconds 10

# Step 7: Test if backend is running
Write-Host "`nStep 7: Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3080/api/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✓ Backend is responding!" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Backend is not responding (this is okay, health endpoint may not exist)" -ForegroundColor Yellow
}

# Step 8: Instructions for testing
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Next Steps - Manual Testing Required" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open browser: http://localhost:3090" -ForegroundColor White
Write-Host "2. Create a new chat" -ForegroundColor White
Write-Host "3. Enable 'Web Search' in tools menu" -ForegroundColor White
Write-Host "4. Ask: 'What is moltbot?'" -ForegroundColor White
Write-Host ""
Write-Host "EXPECTED RESULT:" -ForegroundColor Green
Write-Host "  - Agent says: 'Let me search for...' (natural language)" -ForegroundColor Green
Write-Host "  - Provides detailed answer with sources" -ForegroundColor Green
Write-Host "  - NO XML tags like <web_search>...</web_search>" -ForegroundColor Green
Write-Host ""
Write-Host "IF YOU STILL SEE XML TAGS:" -ForegroundColor Yellow
Write-Host "  1. Hard refresh browser (Ctrl+Shift+R)" -ForegroundColor Yellow
Write-Host "  2. Check backend console for errors" -ForegroundColor Yellow
Write-Host "  3. Run: npm run backend:dev again" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend is running in separate window!" -ForegroundColor Cyan
Write-Host "Check that window for any errors." -ForegroundColor Cyan
Write-Host ""
