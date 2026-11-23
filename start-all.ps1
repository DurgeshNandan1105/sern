# Start SERN (Smart Emergency Response Network) Full-Stack Application
$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting SERN - Smart Emergency Response Network" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Clean up any existing instances on ports 8000, 5173, 5174
Write-Host "`n[Checking Ports] Ensuring ports 8000 and 5173 are clear..." -ForegroundColor Gray
Get-NetTCPConnection -LocalPort 8000, 5173, 5174 -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    } catch {}
}

# 2. Start Backend FastAPI Server
Write-Host "[1/2] Launching Backend FastAPI service on http://localhost:8000..." -ForegroundColor Yellow
$backendCmd = "Set-Location '$root'; Write-Host '=== SERN Backend (FastAPI + AI Engine + WebSockets) ===' -ForegroundColor Cyan; .\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $backendCmd

Start-Sleep -Seconds 3

# 3. Start Frontend Vite Application
Write-Host "[2/2] Launching Frontend React application on http://localhost:5173..." -ForegroundColor Yellow
$frontendCmd = "Set-Location '$root\frontend'; Write-Host '=== SERN Frontend (React 19 + Live GPS Map) ===' -ForegroundColor Cyan; npm run dev -- --port 5173"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  SERN System is Running Successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Frontend URL: http://localhost:5173" -ForegroundColor White
Write-Host "Backend API:  http://localhost:8000" -ForegroundColor White
Write-Host "API Docs:     http://localhost:8000/docs" -ForegroundColor White
Write-Host "WebSocket:    ws://localhost:8000/api/ws" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
