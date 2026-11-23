# Run SERN Frontend Application
Write-Host "Starting SERN React Frontend on http://localhost:5173..." -ForegroundColor Cyan
Set-Location frontend
npm run dev -- --port 5173
