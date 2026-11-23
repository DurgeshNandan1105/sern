# Run SERN Backend Server
Write-Host "Starting SERN FastAPI Backend on http://localhost:8000..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000
